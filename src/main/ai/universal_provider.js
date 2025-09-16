const settings = require('../settings');

async function callAI(prompt) {
  const s = settings.getSettings();
  const provider = s.aiProvider || 'openai';

  console.log('🤖 [AI] Using provider:', provider);

  if (provider === 'perplexity') {
    return await callPerplexity(prompt, s);
  } else {
    return await callOpenAI(prompt, s);
  }
}

async function callPerplexity(prompt, settings) {
  const apiKey = settings.perplexityApiKey || process.env.PERPLEXITY_API_KEY;
  const model = settings.perplexityModel || 'sonar';

  console.log('🤖 [Perplexity] API config:', {
    hasApiKey: !!apiKey,
    model: model
  });

  if (!apiKey) throw new Error('PERPLEXITY_API_KEY not configured');

  const requestParams = {
    model: model,
    messages: [
      { role: 'user', content: prompt }
    ],
    temperature: 0.1,
  };

  console.log('🤖 [Perplexity] Request params:', requestParams);

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestParams),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Perplexity API error: ${response.status} ${errorText}`);
  }

  const completion = await response.json();
  console.log('🤖 [Perplexity] Full completion response:', completion);

  const content = completion.choices?.[0]?.message?.content || '';
  console.log('🤖 [Perplexity] Extracted content:', content);

  return content;
}

async function callOpenAI(prompt, settings) {
  const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY;
  const baseURL = settings.openaiApiBaseUrl || process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE_URL;
  const model = settings.openaiModel || 'gpt-5';

  console.log('🤖 [OpenAI] API config:', {
    hasApiKey: !!apiKey,
    baseURL: baseURL || 'default',
    model: model
  });

  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const { OpenAI } = require('openai');
  const client = new OpenAI({ apiKey, baseURL });

  // o1 models don't support system messages and temperature
  const isO1Model = model.startsWith('o1-');

  const requestParams = {
    model: model,
    messages: isO1Model ? [
      { role: 'user', content: `You are a strict JSON-only bibliographic assistant.\n\n${prompt}` }
    ] : [
      { role: 'system', content: 'You return only strict JSON. No prose.' },
      { role: 'user', content: prompt },
    ],
  };

  // Only add temperature for non-o1 models
  if (!isO1Model) {
    requestParams.temperature = 0.1;
  }

  console.log('🤖 [OpenAI] Request params:', requestParams);

  const completion = await client.chat.completions.create(requestParams);
  console.log('🤖 [OpenAI] Full completion response:', completion);

  const content = completion.choices?.[0]?.message?.content || '';
  console.log('🤖 [OpenAI] Extracted content:', content);

  return content;
}

module.exports = { callAI };
