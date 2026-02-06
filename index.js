import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver, MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import readline from "node:readline/promises"
import { ChatGroq } from "@langchain/groq";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import {TavilySearch} from "@langchain/tavily"
import { threadId } from "node:worker_threads";


// Memory checkpointer → saves chat history per thread
const checkPointer=new MemorySaver()
/*
initailise the tool node
*/
const tool=new TavilySearch({
   maxResults:3,
   topic:"general"
});
const tools=[tool]
const toolNode =new ToolNode(tools)

/*
  1) define node function
  2) build the graph
  3)complie and invoke the graph
*/


const r1=readline.createInterface({
    input:process.stdin,// this take input for terminal
    output:process.stdout
});

/*
 initalise  the LLM
*/
const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY, 
  model: "openai/gpt-oss-120b",
  temperature:0,
  maxRetries:2

}).bindTools(tools)


//  1) define node function
async function callModel(state){   //state has value of messages:[{role:"user",content:userInput}]
    // call the llm using API  

    console.log("calling LLM...");

    const response=await llm.invoke(state.messages);
    return {messages:[response ]} // this response is return will go in langGraph state 
    //  messages:[response ] this is only write in langraph and langchain it  handle internally merge 


//before return 
//     state.messages = [
//   { role: "user", content: "Hi" }
// ]

// after return 
//state.messages = [
//   { role: "user", content: "Hi" },
//   { role: "assistant", content: "Hello! How can I help you?" }
// ]


   
}

function shouldContinue(state){
   // whether to call tool or end
   const lastmessage=state.messages[state.messages.length - 1];
   if(lastmessage.tool_calls.length > 0){
      return "tools"
   }
  return "__end__"
}

// 2) build the graph
const workflow =new StateGraph(MessagesAnnotation).addNode("agent",callModel).addNode("tools",toolNode).addEdge("__start__","agent").addEdge("tools","agent").addConditionalEdges("agent",shouldContinue);

//3)complie 
const app = workflow.compile({ checkpointer: checkPointer /* Enable memory saving*/   })


async function main() {
    while(true){
        
        const userInput=await r1.question("You:");
        if(userInput==="/bye") break;
       //4)invoke the graph
      const finalstate= await app.invoke({
           messages:[{role:"user",content:userInput}]
       },{configurable:{thread_id:"1"}})
       const lastmessage=finalstate.messages[finalstate.messages.length - 1];
        console.log("AI:",lastmessage.content);
    }
    r1.close();
}

main()

/* 
================= HOW THIS AGENT WORKS (FULL FLOW) =================

🧠 OVERVIEW
This is a Tool-Calling AI Agent built using:

- LangGraph → Workflow engine
- LangChain → LLM + Tools wrapper
- Groq → Model provider
- Tavily → Search tool
- Readline → Terminal chat UI

Flow:
User → Agent(LLM) → Tool (if needed) → Agent → Output


---------------------------------------------------------------
1️⃣ TOOL INITIALISATION
---------------------------------------------------------------

const tool = new TavilySearch({...})

→ Tavily is a web search tool
→ maxResults: 3 → returns top 3 search results
→ topic: "general" → general web search

tools array created:

const tools = [tool]

Then wrapped inside ToolNode:

const toolNode = new ToolNode(tools)

ToolNode allows LangGraph to execute tools.


---------------------------------------------------------------
2️⃣ LLM INITIALISATION
---------------------------------------------------------------

const llm = new ChatGroq({...}).bindTools(tools)

→ ChatGroq connects to Groq API
→ Model: openai/gpt-oss-120b
→ temperature: 0 → deterministic output

.bindTools(tools) does:

LLM now knows:

• What tools exist  
• When to call them  
• How to format tool_calls


---------------------------------------------------------------
3️⃣ NODE FUNCTION — AGENT
---------------------------------------------------------------

async function callModel(state)

state contains:

{
  messages: [
    { role: "user", content: "..." }
  ]
}

Steps:

1. Print → "calling LLM..."
2. Send messages → llm.invoke()
3. LLM generates response
4. Return:

return { messages: [response] }

LangGraph auto-merges messages.


---------------------------------------------------------------
4️⃣ CONDITIONAL EDGE LOGIC
---------------------------------------------------------------

function shouldContinue(state)

Purpose:
Decide next step.

Steps:

1. Get last message:

const lastmessage = state.messages.at(-1)

2. Check tool calls:

if (lastmessage.tool_calls.length > 0)

If TRUE →
   go to "tools" node

If FALSE →
   end graph (__end__)


---------------------------------------------------------------
5️⃣ GRAPH BUILDING
---------------------------------------------------------------

const workflow = new StateGraph(MessagesAnnotation)

Nodes added:

.addNode("agent", callModel)
.addNode("tools", toolNode)

Edges:

START → agent
tools → agent   (loop back after tool runs)

Conditional:

agent → tools OR end


Graph structure:

        ┌──────────┐
START → │  Agent   │
        └────┬─────┘
             │
     tool_calls ?
        YES │ NO
             │
      ┌──────▼─────┐
      │   Tools    │
      └──────┬─────┘
             │
             └────→ Agent → END


---------------------------------------------------------------
6️⃣ GRAPH COMPILE
---------------------------------------------------------------

const app = workflow.compile()

→ Converts graph → runnable app


---------------------------------------------------------------
7️⃣ RUNTIME LOOP
---------------------------------------------------------------

while(true)

Terminal chat runs continuously.

User input taken:

const userInput = await r1.question("You:")


---------------------------------------------------------------
8️⃣ GRAPH INVOCATION
---------------------------------------------------------------

const finalstate = await app.invoke({
  messages: [
    { role: "user", content: userInput }
  ]
})

Graph execution starts.


---------------------------------------------------------------
9️⃣ EXECUTION SCENARIOS
---------------------------------------------------------------

CASE 1 — No Tool Needed

User: "Hello"

Flow:

Agent → LLM → Response → END


CASE 2 — Tool Needed

User: "Search latest AI news"

Flow:

Agent → LLM decides tool_call →
Tools Node executes Tavily →
Results returned →
Agent summarises →
END


---------------------------------------------------------------
🔟 STATE AUTO-MERGE
---------------------------------------------------------------

Before:

[
  { role: "user", content: "Hi" }
]

After Agent:

[
  { role: "user", content: "Hi" },
  { role: "assistant", content: "Hello!" }
]

After Tool:

[
  user,
  assistant(tool_call),
  tool_result,
  assistant(final_answer)
]


---------------------------------------------------------------
1️⃣1️⃣ FINAL OUTPUT
---------------------------------------------------------------

const lastmessage =
  finalstate.messages[finalstate.messages.length - 1];

console.log("AI:", lastmessage.content);

Prints final AI reply.


---------------------------------------------------------------
1️⃣2️⃣ LOOP EXIT
---------------------------------------------------------------

If user types:

/bye

Loop breaks → readline closes.


===============================================================
🔚 SUMMARY
===============================================================

• Readline → takes user input
• Graph → controls workflow
• Agent → calls LLM
• LLM → may call tools
• ToolNode → executes tools
• State → stores conversation
• Conditional edges → decide flow

This creates a fully functional Tool-Calling AI Agent.
===============================================================
*/
