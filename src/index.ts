import * as dotenv from 'dotenv';
dotenv.config();

import { Telegraf } from "telegraf";
import { Model as ChatModel } from "./models/chat";
import fs from 'fs';

const telegramToken = process.env.TELEGRAM_TOKEN;
if (!telegramToken) {
  throw new Error('TELEGRAM_TOKEN is not defined in the environment');
}

const bot = new Telegraf(telegramToken);  
let model = new ChatModel();
const startTime = Date.now();

interface User {
  telegramId: string;
  name: string;
  chatHistory: {
    input: string;
    output: string;
    timestamp: Date;
  }[];
  preferences: any;
}

const loadUsers = (): User[] => {
  try {
    const data = fs.readFileSync('users.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error loading users from JSON file: ${error}`);
    return [];
  }
}

const saveUsers = (users: User[]) => {
  try {
    const data = JSON.stringify(users, null, 2);
    fs.writeFileSync('./users.json', data);
  } catch (error) {
    console.error(`Error saving users to JSON file: ${error}`);
  }
}

const logConversation = (userId: string, name: string, input: string, output: string) => {
  const timestamp = new Date();
  const logEntry = { input, output, timestamp };
  
  const users = loadUsers();
  
  let user = users.find(user => user.telegramId === userId);
  
  if (!user) {
    user = { telegramId: userId, name, chatHistory: [], preferences: {} };
    users.push(user);
  }
  
  user.chatHistory.push(logEntry);
  
  saveUsers(users);
}

bot.start((ctx) => {
  try {
    ctx.reply(`Hi, I'm ISCbot, your guide to International Stable Currency. How can I help?`);
  } catch (error) {
    console.error(`Error sending start message: ${error}`);
  }
});

bot.help((ctx) => {
  try {
    ctx.reply("Send me a message starting with /bot and I will assist you.");
  } catch (error) {
    console.error(`Error sending help message: ${error}`);
  }
});

bot.on('message', async (ctx) => {
  if (ctx.message.date * 1000 < startTime) {
    return;
  }

  // Check if the message is a text message
  if ('text' in ctx.message) {
    const text = ctx.message.text;
    const triggerWord = "/bot";

    if (text.startsWith(triggerWord)) {
      await ctx.sendChatAction("typing");
      let inputText = text.replace(triggerWord, "").trim();

      // Check if it's a reply to another message
      if (ctx.message.reply_to_message && 'text' in ctx.message.reply_to_message) {
        inputText = ctx.message.reply_to_message.text;
      }

      try {
        let response;

        if (inputText.toLowerCase() === "hi bot" || inputText.toLowerCase() === "hello bot") {
          response = "Hi, I'm ISCbot, feel free to talk to me. How can I be of assistance today?";
        } else {
          response = await model.call(inputText);
        }

        console.log("Generated Response: ", response); 

        if (!response) {
          response = "Sorry, I couldn't generate a response. For more info, visit isc.money";
        }

        const name = ctx.from.first_name;
        logConversation(ctx.from.id.toString(), name, text, response);

        await ctx.reply(response);

      } catch (error) {
        console.error(`Error processing message: ${error}`);
        await ctx.reply("I encountered an error processing your request.");
      }
    }
  }
});

async function botStartupFunc() {
  try {
    await model.init();
  } catch (error) {
    console.error(`Error initializing model: ${error}`);
    return;
  }
}

botStartupFunc();
bot.launch();

process.on("SIGTERM", () => {
  bot.stop("SIGTERM");
});
