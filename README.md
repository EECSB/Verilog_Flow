# Verilog Flow

![decent paste app image](https://eecs.blog/wp-content/uploads/2026/01/verilog-flow-app-image.png)

## About
<div>
   I wanted to make a similar app for some time, but I never got to it. Now with all the AI tools out there, I thought I'd try and see how quickly I can vibe code it.
   I used Google AI Studio. At first, it went quite well, but as the app got slightly bigger and the context window got larger, it became basically impossible to add any new feature without it breaking something else that was working before.
</div>
<br>
<div>
   To avoid this, you would have to open up this project in an IDE with one of the AI extensions and take a more hands-on on granular approach to building the app.
   This means giving the AI smaller, more specific tasks. 
   Additionally, you should take the "spec-driven development" approach with something like <a href="https://github.com/github/spec-kit" target="_blank">Spec Kit</a> or some other similar tool.
</div>
<br>
<div>
   I didn't bother with this, as this is just a little toy app I wanted to make while also testing out AI tools.
</div>
<br>

## Features 
   VerilogFlow allows you to generate Verilog from a schematic of logic gates.
   <div>
      <img height="475" alt="GHBanner" src="https://eecs.blog/wp-content/uploads/2026/01/verilog-flow-schematic-to-layout.png" />
   </div>
   <br>

   You can manually drag and drop logic gates onto the canvas and connect them, or you can use AI to convert a schematic to a layout.
   <div>
      <img height="475" alt="GHBanner" src="https://eecs.blog/wp-content/uploads/2026/01/verilog-flow-canvas.png" />
   </div>
   <br>

   At the end, you can get the Verilog output for your design.
   <div>
      <img height="475" alt="GHBanner" src="https://eecs.blog/wp-content/uploads/2026/01/verilog-flow-verilog-output.png" />
   </div

<br>
<br>

## Try it out
You can try it out [here](https://verilogflow-logic-gate-designer-843674838026.us-west1.run.app/).

<br>
<br>

# Stuff added by Google AI Studio

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1HWtq6XI4sKA1s5prgWWyJ85lvV4y8I6C

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


