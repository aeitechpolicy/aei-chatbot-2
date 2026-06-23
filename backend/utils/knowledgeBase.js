const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

class TxtKnowledgeBase {
  constructor(knowledgeBasePath = 'knowledge_base') {
    this.kbPath = path.resolve(knowledgeBasePath);
    this.cacheFile = path.join(this.kbPath, 'content_cache.json');
    this.metadataFile = path.join(this.kbPath, 'metadata.json');
    this.contentCache = {};
    this.fileHashes = {};
    this.domainMetadata = {};
    
    // Ensure knowledge base directory exists
    fs.ensureDirSync(this.kbPath);
    this.loadCache();
    this.loadMetadata();
  }

  async loadCache() {
    try {
      if (await fs.pathExists(this.cacheFile)) {
        const cacheData = await fs.readJson(this.cacheFile);
        this.contentCache = cacheData.content || {};
        this.fileHashes = cacheData.hashes || {};
      }
    } catch (error) {
      console.error('Error loading cache:', error);
      this.contentCache = {};
      this.fileHashes = {};
    }
  }

  async saveCache() {
    try {
      const cacheData = {
        content: this.contentCache,
        hashes: this.fileHashes,
        lastUpdated: new Date().toISOString()
      };
      await fs.writeJson(this.cacheFile, cacheData, { spaces: 2 });
    } catch (error) {
      console.error('Error saving cache:', error);
    }
  }

  async loadMetadata() {
    try {
      if (await fs.pathExists(this.metadataFile)) {
        const metadata = await fs.readJson(this.metadataFile);
        this.domainMetadata = metadata.domains || {};
      }
    } catch (error) {
      console.error('Error loading metadata:', error);
      this.domainMetadata = {};
    }
  }

  async saveMetadata() {
    try {
      const metadata = {
        domains: this.domainMetadata,
        lastUpdated: new Date().toISOString()
      };
      await fs.writeJson(this.metadataFile, metadata, { spaces: 2 });
    } catch (error) {
      console.error('Error saving metadata:', error);
    }
  }

  async getFileHash(filePath) {
    try {
      const fileBuffer = await fs.readFile(filePath);
      return crypto.createHash('md5').update(fileBuffer).digest('hex');
    } catch (error) {
      console.error('Error getting file hash:', error);
      return null;
    }
  }

  async readTxtFile(filePath) {
    const encodings = ['utf8', 'latin1', 'ascii'];
    
    for (const encoding of encodings) {
      try {
        return await fs.readFile(filePath, encoding);
      } catch (error) {
        continue;
      }
    }
    
    throw new Error(`Could not read ${path.basename(filePath)} with any encoding`);
  }

  async createDomain(domainName, description = '') {
    try {
      // Validate domain name
      if (!domainName || !domainName.trim()) {
        return false;
      }

      const sanitizedName = domainName.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      const domainPath = path.join(this.kbPath, sanitizedName);
      
      // Check if domain already exists
      if (await fs.pathExists(domainPath)) {
        return false;
      }

      // Create domain directory
      await fs.ensureDir(domainPath);

      // Update metadata
      this.domainMetadata[sanitizedName] = {
        name: domainName,
        description: description || `${domainName} knowledge domain`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fileCount: 0
      };

      await this.saveMetadata();
      return true;
    } catch (error) {
      console.error('Error creating domain:', error);
      return false;
    }
  }

  async deleteDomain(domainName) {
    try {
      const domainPath = path.join(this.kbPath, domainName);
      
      if (!(await fs.pathExists(domainPath))) {
        return false;
      }

      // Remove domain directory and all files
      await fs.remove(domainPath);

      // Clean up cache
      const cacheKeys = Object.keys(this.contentCache).filter(key => 
        key.startsWith(`${domainName}_`)
      );
      cacheKeys.forEach(key => {
        delete this.contentCache[key];
        delete this.fileHashes[key];
      });

      // Remove from metadata
      delete this.domainMetadata[domainName];

      await this.saveCache();
      await this.saveMetadata();
      return true;
    } catch (error) {
      console.error('Error deleting domain:', error);
      return false;
    }
  }

  async getAvailableDomains() {
    try {
      const domains = {};
      const items = await fs.readdir(this.kbPath);
      
      for (const item of items) {
        const itemPath = path.join(this.kbPath, item);
        const stat = await fs.stat(itemPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'chats') {
          const txtFiles = await fs.readdir(itemPath);
          const txtFileList = txtFiles.filter(file => file.endsWith('.txt'));
          
          const metadata = this.domainMetadata[item] || {
            name: item,
            description: `${item.replace(/_/g, ' ')} (${txtFileList.length} txt files)`,
            createdAt: stat.birthtime.toISOString(),
            updatedAt: stat.mtime.toISOString(),
            fileCount: txtFileList.length
          };

          domains[item] = {
            path: itemPath,
            file_count: txtFileList.length,
            files: txtFileList,
            description: metadata.description,
            name: metadata.name,
            createdAt: metadata.createdAt,
            updatedAt: metadata.updatedAt
          };

          // Update metadata if it was missing
          if (!this.domainMetadata[item]) {
            this.domainMetadata[item] = metadata;
          }
        }
      }
      
      await this.saveMetadata();
      return domains;
    } catch (error) {
      console.error('Error getting available domains:', error);
      return {};
    }
  }

  async loadDomainContent(domainName) {
    try {
      const domainPath = path.join(this.kbPath, domainName);
      
      if (!(await fs.pathExists(domainPath))) {
        return {};
      }

      const domainContent = {};
      const files = await fs.readdir(domainPath);
      const txtFiles = files.filter(file => file.endsWith('.txt'));

      for (const txtFile of txtFiles) {
        const filePath = path.join(domainPath, txtFile);
        const fileHash = await this.getFileHash(filePath);
        const cacheKey = `${domainName}_${txtFile}`;

        let content;
        if (this.fileHashes[cacheKey] === fileHash && this.contentCache[cacheKey]) {
          content = this.contentCache[cacheKey];
        } else {
          content = await this.readTxtFile(filePath);
          if (content.trim()) {
            this.contentCache[cacheKey] = content;
            this.fileHashes[cacheKey] = fileHash;
          }
        }

        if (content.trim()) {
          domainContent[txtFile] = content;
        }
      }
      
      await this.saveCache();
      return domainContent;
    } catch (error) {
      console.error('Error loading domain content:', error);
      return {};
    }
  }

  async getFileContent(domainName, filename) {
    try {
      const filePath = path.join(this.kbPath, domainName, filename);
      
      if (!(await fs.pathExists(filePath))) {
        return null;
      }

      return await this.readTxtFile(filePath);
    } catch (error) {
      console.error('Error getting file content:', error);
      return null;
    }
  }

  async updateFileContent(domainName, filename, content) {
    try {
      const filePath = path.join(this.kbPath, domainName, filename);
      
      if (!(await fs.pathExists(filePath))) {
        return false;
      }

      await fs.writeFile(filePath, content, 'utf8');
      
      // Clear cache for this file
      const cacheKey = `${domainName}_${filename}`;
      delete this.contentCache[cacheKey];
      delete this.fileHashes[cacheKey];

      // Update domain metadata
      if (this.domainMetadata[domainName]) {
        this.domainMetadata[domainName].updatedAt = new Date().toISOString();
        await this.saveMetadata();
      }

      await this.saveCache();
      return true;
    } catch (error) {
      console.error('Error updating file content:', error);
      return false;
    }
  }

  async deleteFile(domainName, filename) {
    try {
      const filePath = path.join(this.kbPath, domainName, filename);
      
      if (!(await fs.pathExists(filePath))) {
        return false;
      }

      await fs.remove(filePath);
      
      // Clear cache for this file
      const cacheKey = `${domainName}_${filename}`;
      delete this.contentCache[cacheKey];
      delete this.fileHashes[cacheKey];

      // Update domain metadata
      if (this.domainMetadata[domainName]) {
        this.domainMetadata[domainName].fileCount = Math.max(0, this.domainMetadata[domainName].fileCount - 1);
        this.domainMetadata[domainName].updatedAt = new Date().toISOString();
        await this.saveMetadata();
      }

      await this.saveCache();
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  async getDomainStats(domainName) {
    try {
      const domainPath = path.join(this.kbPath, domainName);
      
      if (!(await fs.pathExists(domainPath))) {
        return null;
      }

      const files = await fs.readdir(domainPath);
      const txtFiles = files.filter(file => file.endsWith('.txt'));
      
      let totalSize = 0;
      let totalWords = 0;
      let totalLines = 0;

      for (const file of txtFiles) {
        const filePath = path.join(domainPath, file);
        const stats = await fs.stat(filePath);
        const content = await this.readTxtFile(filePath);
        
        totalSize += stats.size;
        totalWords += content.split(/\s+/).length;
        totalLines += content.split('\n').length;
      }

      return {
        domain: domainName,
        fileCount: txtFiles.length,
        totalSize,
        totalWords,
        totalLines,
        files: txtFiles,
        averageFileSize: txtFiles.length > 0 ? Math.round(totalSize / txtFiles.length) : 0,
        metadata: this.domainMetadata[domainName] || null
      };
    } catch (error) {
      console.error('Error getting domain stats:', error);
      return null;
    }
  }

  async searchAcrossDomains(query, specificDomain = null) {
    try {
      const domains = await this.getAvailableDomains();
      const results = [];
      const queryWords = query.toLowerCase().split(/\s+/);

      const domainsToSearch = specificDomain ? 
        { [specificDomain]: domains[specificDomain] } : 
        domains;

      for (const [domainName, domainInfo] of Object.entries(domainsToSearch)) {
        if (!domainInfo) continue;

        const domainContent = await this.loadDomainContent(domainName);
        const searchResults = this.searchContent(domainContent, query, 5);

        for (const result of searchResults) {
          results.push({
            domain: domainName,
            filename: result.filename,
            score: result.score,
            content: result.content,
            matchedContent: result.content
          });
        }
      }

      return results.sort((a, b) => b.score - a.score);
    } catch (error) {
      console.error('Error searching across domains:', error);
      return [];
    }
  }

  searchContent(domainContent, query, maxResults = 3) {
   const normalizeText = (text = '') =>
  text
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const stopWords = new Set([
  // generic question words
  'what', 'has', 'have', 'had',
  'is', 'are', 'was', 'were',
  'do', 'does', 'did',
  'can', 'could', 'would', 'should',

  // small connector words
  'the', 'a', 'an',
  'and', 'or', 'but',
  'about', 'with', 'from', 'into', 'for', 'on', 'in', 'of', 'to', 'by',

  // chatbot request words
  'written', 'write', 'writes',
  'said', 'say', 'says',
  'argue', 'argues', 'argued',
  'tell', 'me', 'show', 'find', 'summarize',

  // scholar names
  'shane', 'tews',
  'will', 'rinehart',
  'clay', 'calvert',
  'brent', 'orrell'
]);

const normalizedQuery = normalizeText(query);

const rawQueryWords = normalizedQuery
  .split(' ')
  .filter(word => word.length > 2);

const queryWords = rawQueryWords.filter(word => !stopWords.has(word));

// fallback: if the user only typed stop words, use the raw words
const effectiveQueryWords = queryWords.length > 0 ? queryWords : rawQueryWords;

const queryPhrases = [];
for (let i = 0; i < effectiveQueryWords.length - 1; i++) {
  queryPhrases.push(`${effectiveQueryWords[i]} ${effectiveQueryWords[i + 1]}`);
}

const results = [];

   for (const [filename, content] of Object.entries(domainContent)) {
  const lines = content.split('\n');
  const filenameText = normalizeText(filename.replace(/\.txt$/, ''));

  let score = 0;
  const matchedIndices = new Set();

  // Filename matches are strong relevance signals.
  effectiveQueryWords.forEach(word => {
    if (filenameText.includes(word)) {
      score += 10;
    }
  });

  // Exact phrase matches in filenames are even stronger.
  queryPhrases.forEach(phrase => {
    if (filenameText.includes(phrase)) {
      score += 25;
    }
  });

  lines.forEach((line, i) => {
  const lineLower = normalizeText(line);

  let lineScore = 0;

  effectiveQueryWords.forEach(word => {
    if (lineLower.includes(word)) {
      lineScore += 1;
    }
  });

  queryPhrases.forEach(phrase => {
    if (lineLower.includes(phrase)) {
      lineScore += 5;
    }
  });

  if (lineScore > 0) {
    score += lineScore;

    // Include 2 lines of context above and below each match
    for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 2); j++) {
      matchedIndices.add(j);
    }
  }
});

      if (score > 0) {
        // Build contiguous context blocks from matched indices
        const sortedIndices = [...matchedIndices].sort((a, b) => a - b);
        const contextChunks = [];
        let chunk = [sortedIndices[0]];
        for (let k = 1; k < sortedIndices.length; k++) {
          if (sortedIndices[k] === sortedIndices[k - 1] + 1) {
            chunk.push(sortedIndices[k]);
          } else {
            contextChunks.push(chunk);
            chunk = [sortedIndices[k]];
          }
        }
        contextChunks.push(chunk);

        // Take top 3 chunks by density, join with separator
        const scoredChunks = contextChunks.map(c => ({
          text: c.map(i => lines[i]).join('\n'),
          score: c.reduce((acc, i) => acc + queryWords.reduce((a, w) =>
            a + (lines[i].toLowerCase().includes(w) ? 1 : 0), 0), 0)
        }));
        const topChunks = scoredChunks
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map(c => c.text)
          .join('\n\n---\n\n');

        results.push({ filename, score, content: topChunks });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, maxResults);
  }

  async saveDomainFile(domainName, filename, content) {
    try {
      const domainPath = path.join(this.kbPath, domainName);
      await fs.ensureDir(domainPath);
      
      const filePath = path.join(domainPath, filename);
      const isNewFile = !(await fs.pathExists(filePath));
      
      await fs.writeFile(filePath, content, 'utf8');
      
      // Clear cache for this file
      const cacheKey = `${domainName}_${filename}`;
      delete this.contentCache[cacheKey];
      delete this.fileHashes[cacheKey];

      // Update domain metadata
      if (!this.domainMetadata[domainName]) {
        this.domainMetadata[domainName] = {
          name: domainName,
          description: `${domainName.replace(/_/g, ' ')} knowledge domain`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          fileCount: 0
        };
      }

      if (isNewFile) {
        this.domainMetadata[domainName].fileCount += 1;
      }
      this.domainMetadata[domainName].updatedAt = new Date().toISOString();

      await this.saveMetadata();
      return true;
    } catch (error) {
      console.error('Error saving domain file:', error);
      return false;
    }
  }
}

module.exports = TxtKnowledgeBase;
