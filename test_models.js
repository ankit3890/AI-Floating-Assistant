const { GoogleGenerativeAI } = require("@google/generative-ai");

// The key currently in main.js
const GEMINI_API_KEY = "AIzaSyACBzqta_aLDbIqaUJnlup0h-Fjx6NixGE"; 

async function listModels() {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  console.log("Checking available models for key: " + GEMINI_API_KEY.substring(0, 10) + "...");
  try {
      // Note: listModels is not directly on genAI instance in some versions, 
      // but usually available via a model manager or we can just try to generate with a basic one.
      // Actually, the error message said "Call ListModels". 
      // In the Node SDK, it's often not exposed directly on the top-level class in older versions,
      // but let's try a standard generation with a known older model 'gemini-pro'.
      
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      console.log("Attempting generation with gemini-pro...");
      const result = await model.generateContent("Hello");
      console.log("Success with gemini-pro!");
      console.log(result.response.text());
  } catch (error) {
    console.error("Error with gemini-pro:", error.message);
  }

  try {
      const model2 = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      console.log("Attempting generation with gemini-1.5-flash...");
      const result2 = await model2.generateContent("Hello");
      console.log("Success with gemini-1.5-flash!");
      console.log(result2.response.text());
  } catch (error) {
      console.error("Error with gemini-1.5-flash:", error.message);
  }
}

listModels();
