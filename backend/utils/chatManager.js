const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class ChatManager {
  constructor(chatsPath = 'chats') {
    this.chatsPath = path.resolve(chatsPath);
    this.chatsIndexFile = path.join(this.chatsPath, 'index.json');
    
    // Ensure chats directory exists
    fs.ensureDirSync(this.chatsPath);
    this.initializeIndex();
  }

  async initializeIndex() {
    try {
      if (!(await fs.pathExists(this.chatsIndexFile))) {
        await fs.writeJson(this.chatsIndexFile, { chats: [] }, { spaces: 2 });
      }
    } catch (error) {
      console.error('Error initializing chat index:', error);
    }
  }

  async getChatsIndex() {
    try {
      const indexData = await fs.readJson(this.chatsIndexFile);
      return indexData.chats || [];
    } catch (error) {
      console.error('Error reading chats index:', error);
      return [];
    }
  }

  async updateChatsIndex(chats) {
    try {
      await fs.writeJson(this.chatsIndexFile, { chats }, { spaces: 2 });
    } catch (error) {
      console.error('Error updating chats index:', error);
    }
  }

  async createChat(domainName = 'General', title = null, userId = 'anonymous') {
    try {
      const chatId = uuidv4();
      const now = new Date().toISOString();
      
      const chat = {
        id: chatId,
        userId: userId,
        title: title || 'New Chat',
        domainName: domainName,
        createdAt: now,
        updatedAt: now,
        messages: []
      };

      // Save chat file
      const chatFilePath = path.join(this.chatsPath, `${chatId}.json`);
      await fs.writeJson(chatFilePath, chat, { spaces: 2 });

      // Update index
      const chats = await this.getChatsIndex();
      chats.unshift({
        id: chatId,
        userId: userId,
        title: chat.title,
        domainName: domainName,
        createdAt: now,
        updatedAt: now,
        messageCount: 0
      });

      await this.updateChatsIndex(chats);

      return chat;
    } catch (error) {
      console.error('Error creating chat:', error);
      throw error;
    }
  }

  async getChat(chatId) {
    try {
      const chatFilePath = path.join(this.chatsPath, `${chatId}.json`);
      
      if (!(await fs.pathExists(chatFilePath))) {
        return null;
      }

      const chat = await fs.readJson(chatFilePath);
      return chat;
    } catch (error) {
      console.error('Error getting chat:', error);
      return null;
    }
  }

  async getUserChats(userId) {
    try {
      const allChats = await this.getChatsIndex();
      const userChats = allChats.filter(chat => chat.userId === userId);
      return userChats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } catch (error) {
      console.error('Error getting user chats:', error);
      return [];
    }
  }

  async getChatWithUserCheck(chatId, userId) {
    try {
      const chat = await this.getChat(chatId);
      if (!chat) {
        return null; // Chat doesn't exist
      }
      if (chat.userId !== userId) {
        return null; // Chat doesn't belong to user
      }
      return chat;
    } catch (error) {
      console.error('Error getting chat with user check:', error);
      return null;
    }
  }

  async getAllChats() {
    try {
      const chats = await this.getChatsIndex();
      return chats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } catch (error) {
      console.error('Error getting all chats:', error);
      return [];
    }
  }

  async addMessage(chatId, message, initialTitle = null) {
    try {
      const chat = await this.getChat(chatId);
      if (!chat) {
        throw new Error('Chat not found');
      }

      // Add timestamp to message
      const messageWithTimestamp = {
        ...message,
        timestamp: new Date().toISOString()
      };

      chat.messages.push(messageWithTimestamp);
      if (initialTitle && chat.title === 'New Chat') chat.title = initialTitle;
      chat.updatedAt = new Date().toISOString();

      // Save updated chat
      const chatFilePath = path.join(this.chatsPath, `${chatId}.json`);
      await fs.writeJson(chatFilePath, chat, { spaces: 2 });

      // Update index
      const chats = await this.getChatsIndex();
      const chatIndex = chats.findIndex(c => c.id === chatId);
      if (chatIndex !== -1) {
        chats[chatIndex].updatedAt = chat.updatedAt;
        chats[chatIndex].messageCount = chat.messages.length;
        chats[chatIndex].title = chat.title;
        await this.updateChatsIndex(chats);
      }

      return messageWithTimestamp;
    } catch (error) {
      console.error('Error adding message:', error);
      throw error;
    }
  }

  async updateChatTitle(chatId, title) {
    try {
      const chat = await this.getChat(chatId);
      if (!chat) {
        throw new Error('Chat not found');
      }

      chat.title = title;
      chat.updatedAt = new Date().toISOString();

      // Save updated chat
      const chatFilePath = path.join(this.chatsPath, `${chatId}.json`);
      await fs.writeJson(chatFilePath, chat, { spaces: 2 });

      // Update index
      const chats = await this.getChatsIndex();
      const chatIndex = chats.findIndex(c => c.id === chatId);
      if (chatIndex !== -1) {
        chats[chatIndex].title = title;
        chats[chatIndex].updatedAt = chat.updatedAt;
        await this.updateChatsIndex(chats);
      }

      return chat;
    } catch (error) {
      console.error('Error updating chat title:', error);
      throw error;
    }
  }

  async deleteChat(chatId) {
    try {
      const chatFilePath = path.join(this.chatsPath, `${chatId}.json`);
      
      if (!(await fs.pathExists(chatFilePath))) {
        return false;
      }

      // Delete chat file
      await fs.remove(chatFilePath);

      // Update index
      const chats = await this.getChatsIndex();
      const filteredChats = chats.filter(c => c.id !== chatId);
      await this.updateChatsIndex(filteredChats);

      return true;
    } catch (error) {
      console.error('Error deleting chat:', error);
      return false;
    }
  }

  async searchChats(query, limit = 10) {
    try {
      const chats = await this.getAllChats();
      const queryLower = query.toLowerCase();
      
      const matchingChats = chats.filter(chat => 
        chat.title.toLowerCase().includes(queryLower) ||
        chat.domainName.toLowerCase().includes(queryLower)
      );

      return matchingChats.slice(0, limit);
    } catch (error) {
      console.error('Error searching chats:', error);
      return [];
    }
  }

  async getChatsByDomain(domainName) {
    try {
      const chats = await this.getAllChats();
      return chats.filter(chat => chat.domainName === domainName);
    } catch (error) {
      console.error('Error getting chats by domain:', error);
      return [];
    }
  }

  async getRecentChats(limit = 20) {
    try {
      const chats = await this.getAllChats();
      return chats.slice(0, limit);
    } catch (error) {
      console.error('Error getting recent chats:', error);
      return [];
    }
  }
}

module.exports = ChatManager;