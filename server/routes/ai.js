const express = require('express');
const axios = require('axios');

const router = express.Router();

// POST /api/ai/summary
// Body: { username, stats }
// Calls Claude Haiku to generate a 2-sentence developer profile summary.
router.post('/summary', async (req, res) => {
  const { username, stats } = req.body;

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'username is required' });
  }
  if (!stats || typeof stats !== 'object') {
    return res.status(400).json({ error: 'stats object is required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });
  }

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `Generate a 2-sentence developer profile summary for GitHub user "${username}". Stats: ${JSON.stringify(stats)}. Be specific, use the numbers, sound like a LinkedIn recommendation. No fluff. Start with the developer's name.`
        }]
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        }
      }
    );

    const summary = response.data.content[0].text;
    res.json({ summary });
  } catch (err) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.error?.message || err.message;
    res.status(status).json({ error: message });
  }
});

module.exports = router;
