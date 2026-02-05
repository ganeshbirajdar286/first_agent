import { HumanMessage } from "@langchain/core/messages";
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import readline from "node:readline/promises"


/*
  1) define node function
  2) build the graph
  3)complie and invoke the graph
*/


const r1=readline.createInterface({
    input:process.stdin,// this take input for terminal
    output:process.stdout
});

//  1) define node function
function callModel(state){   //state has value of messages:[{role:"user",content:userInput}]
    // call the llm using API  

    console.log("calling LLM...");
   
     return state;
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
        console.log("finalstate:",finalstate);
    }
    r1.close();
}

main()


// how the code run
//1)Readline start
//2)Graph build
//3)Compile
//4)User input
//5)LLM call
//6)Final state print