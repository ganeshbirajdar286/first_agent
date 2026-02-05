import { HumanMessage } from "@langchain/core/messages";
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import readline from "node:readline/promises"
import { ChatGroq } from "@langchain/groq";


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

});


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

// 2) build the graph
const workflow =new StateGraph(MessagesAnnotation).addNode("agent",callModel).addEdge("__start__","agent").addEdge("agent","__end__");

//3)complie 
const app=workflow.compile()

async function main() {
    while(true){
        
        const userInput=await r1.question("You:");
        if(userInput==="/bye") break;
       //4)invoke the graph
      const finalstate= await app.invoke({
           messages:[{role:"user",content:userInput}]
       })
       const lastmessage=finalstate.messages[finalstate.messages.length - 1];
        console.log("AI:",lastmessage.content);
    }
    r1.close();
}

main()

/* 
================= HOW THIS CODE RUNS (STEP-WISE) =================

1️⃣ Readline starts
   → Terminal chat interface is created to take user input.

2️⃣ LLM initialised
   → ChatGroq model is configured with API key + model.

3️⃣ Graph built
   → StateGraph created with:
        START → agent → END

4️⃣ Graph compiled
   → Workflow converted into runnable app.

5️⃣ User enters input
   → Example: "Hello"

6️⃣ Graph invoked
   → User message passed into LangGraph state.

7️⃣ Agent node executes
   → callModel() runs
   → "calling LLM..." printed.

8️⃣ LLM API called
   → llm.invoke(state.messages)

9️⃣ LLM response returned
   → Assistant message generated.

🔟 State updated
   → LangGraph auto-merges:
        user + assistant messages.

1️⃣1️⃣ Final state received
   → Returned from graph execution.

1️⃣2️⃣ Last message extracted
   → Get assistant reply from messages array.

1️⃣3️⃣ AI response printed
   → console.log("AI:", lastmessage.content)

1️⃣4️⃣ Loop repeats
   → Until user types "/bye"

===============================================================
*/
