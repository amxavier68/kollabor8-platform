const axios = require('axios');

class WordPressService {
  constructor() {
    this.wpUrl = process.env.WP_API_URL || 'http://host.docker.internal:80/wordpress/wp-json';
    this.apiKey = process.env.WP_API_KEY;
  }

  async getPosts(params = {}) {
    try {
      const response = await axios.get(`${this.wpUrl}/wp/v2/posts`, {
        params,
        headers: this.getHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching WordPress posts:', error.message);
      throw error;
    }
  }

  async createPost(postData) {
    try {
      const response = await axios.post(`${this.wpUrl}/wp/v2/posts`, postData, {
        headers: this.getHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Error creating WordPress post:', error.message);
      throw error;
    }
  }

  async syncPluginData(data) {
    try {
      const response = await axios.post(
        `${this.wpUrl}/kollabor8/v1/sync`,
        data,
        {
          headers: this.getHeaders()
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error syncing with WordPress plugin:', error.message);
      throw error;
    }
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey
    };
  }
}

module.exports = new WordPressService();