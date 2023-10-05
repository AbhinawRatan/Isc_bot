import * as dotenv from 'dotenv';
dotenv.config();

import { Telegraf, Context } from "telegraf";
import { Model as ChatModel } from "./models/chat";
import fs from 'fs';

const telegramToken = process.env.TELEGRAM_TOKEN as string;
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

const logConversation = (userId: string, name: string, input: any, output: any) => {
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

bot.start(async (ctx) => {
  try {
    const username = ctx.from.username;
    ctx.reply(`Hi, I'm Susan, I'm an expert therapist. Welcome to my Telegram bot, How can I help?`);
  } catch (error) {
    console.error(`Error sending start message: ${error}`);
  }
});

bot.help((ctx) => {
  try {
    ctx.reply("Send me a message and I will echo it back to you.");
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

    const triggerWord = "/bot" ||"mybot" ;

    // Check if the message text starts with the trigger word
    if (ctx.message.text.startsWith(triggerWord)) {

      // Check if this is a reply to another message and it's a text message
      if (ctx.message.reply_to_message && 'text' in ctx.message.reply_to_message) {

        // Use the text of the replied message as input
        let text = ctx.message.reply_to_message.text;

        console.log("Input: ", text);

        await ctx.sendChatAction("typing");
        
        try {
          let response;
          let textTemp = text.toLowerCase();
          if (textTemp == "hi" || textTemp == "hey" || textTemp == "hello" ){
            response = "Hi, I'm ISCbot, feel free to talk to me. How can i be of assistance today?";
          } else {
            response = await model.call(text);
          }
          console.log("Generated Response: ", response); 

          if (!response) {
            response = "Sorry, I couldn't generate a response.";
          }

          const name = ctx.from.first_name;
          logConversation(ctx.from.id.toString(), name, text, response);

          await ctx.reply(response);

        } catch (error) {
        }
      }
    }
  }
});

async function botStartupFunc (){
  try {
    await model.init();
  } catch (error) {
    console.error(`Error initializing model: ${error}`);
    return;
  }
};

botStartupFunc();
bot.launch();

process.on("SIGTERM", () => {
  bot.stop();
});
