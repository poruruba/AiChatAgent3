'use strict';

const HELPER_BASE = process.env.HELPER_BASE || "/opt/";
const Response = require(HELPER_BASE + 'response');
const HttpUtils = require(HELPER_BASE + 'http-utils');

const GOOGLE_GENERATIVE_AI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const MCPGATEWAY_URL = process.env.MCPGATEWAY_URL;
const MCPGATEWAY_SERVER_ID = process.env.MCPGATEWAY_SERVER_ID;
const MCPGATEWAY_TOKEN = process.env.MCPGATEWAY_TOKEN;
const API_KEY = process.env.GEMINI_API_KEY;

const { GoogleGenAI, FunctionCallingConfigMode , mcpToTool, Modality} = require('@google/genai');
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");

const client = new Client({
	name: "mcp-server/mcpgateway",
	version: "0.1.0"
});
const transport = new StdioClientTransport({
  command: "npx",
  args: ["-y", "supergateway", "--sse", MCPGATEWAY_URL + "/servers/" + MCPGATEWAY_SERVER_ID + "/sse", "--oauth2Bearer", MCPGATEWAY_TOKEN]
});

let chat;
let ai;

(async () =>{
  await client.connect(transport);

  ai = new GoogleGenAI({ apiKey: GOOGLE_GENERATIVE_AI_API_KEY });
  chat = ai.chats.create({
//    model: 'gemini-2.5-flash',
		model: 'gemini-1.5-pro-latest',
    config: { 
      tools: [mcpToTool(client)],
   }
  });
})();

exports.handler = async (event, context, callback) => {
	var body = JSON.parse(event.body);
	console.log(body);

	var apikey = event.requestContext.apikeyAuth?.apikey;
	if( apikey != API_KEY )
		throw new Error("invalid apikey");

  if( event.path == '/gemini-generate' ){
    const response = await chat.sendMessage({message: body.message});
    console.log(response);
    
    return new Response({ message: response.text });
  }else

  if( event.path == '/gemini-get-history' ){
    var history = chat.getHistory();

    return new Response({ history: history });
  }else

  if( event.path == '/gemini-list-tools' ){
    var input = {
      url: MCPGATEWAY_URL + "/servers/" + MCPGATEWAY_SERVER_ID + "/tools",
      method: "GET",
      token: MCPGATEWAY_TOKEN
    };
    var result = await HttpUtils.do_http(input);
    console.log(result);
    
    var list = result.map(item => {
      return {
        name: item.name,
        description: item.description,
        inputSchema: item.inputSchema
      };
    });
    return new Response({ list: list });
  }else

	if( event.path == "/gemini-new-thread" ){
    ai = new GoogleGenAI({ apiKey: GOOGLE_GENERATIVE_AI_API_KEY });
    chat = ai.chats.create({
  //    model: 'gemini-2.5-flash',
      model: 'gemini-1.5-pro-latest',
      config: { 
        tools: [mcpToTool(client)],
      }
    });

    return new Response({});
  }else

  if( event.path == '/gemini-generate-image' ){
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-preview-image-generation",
      contents: body.message,
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    var list = [];
    for (const part of response.candidates[0].content.parts) {
      console.log(part);
      if (part.text) {
        list.push({
          type: "text",
          text: part.text
        });
      } else if (part.inlineData) {
        const imageData = part.inlineData.data;
        list.push({
          type: "image",
          image: Buffer.from(imageData, "base64")
        });
      }
    }

    return new Response({ list: list });
  }else

  {
    throw new Error("unknown endpoint");
  }
};
