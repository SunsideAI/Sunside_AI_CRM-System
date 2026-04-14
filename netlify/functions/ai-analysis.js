const fetch = require('node-fetch');

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { stats, dateRange } = JSON.parse(event.body);

    if (!stats) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Stats data required' })
      };
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'OpenAI API key not configured' })
      };
    }

    // Build the prompt with stats data
    const prompt = `Du bist ein Experte für Vertriebsanalysen und Kaltakquise. Analysiere die folgenden Kaltakquise-Statistiken und erstelle eine strukturierte Analyse.

ZEITRAUM: ${dateRange || 'Aktueller Zeitraum'}

STATISTIKEN:
- Einwahlen (Anrufe): ${stats.einwahlen || 0}
- Erreicht (Kontakte): ${stats.erreicht || 0}
- Beratungsgespräche: ${stats.beratungsgespraech || 0}
- Unterlagen versendet: ${stats.unterlagen || 0}
- Kein Interesse: ${stats.keinInteresse || 0}

QUOTEN:
- Erreicht-Quote: ${stats.erreichtQuote || 0}%
- Beratungsgespräch-Quote: ${stats.beratungsgespraechQuote || 0}%
- Unterlagen-Quote: ${stats.unterlagenQuote || 0}%

Erstelle eine Analyse im folgenden JSON-Format:
{
  "zusammenfassung": "Eine kurze Zusammenfassung der Performance in 1-2 Sätzen",
  "insights": [
    {
      "titel": "Insight Titel",
      "beschreibung": "Detaillierte Erklärung des Insights",
      "typ": "positiv|neutral|negativ"
    }
  ],
  "prognosen": [
    {
      "titel": "Prognose Titel",
      "beschreibung": "Detaillierte Prognose basierend auf den Daten"
    }
  ],
  "empfehlungen": [
    "Konkrete Handlungsempfehlung 1",
    "Konkrete Handlungsempfehlung 2"
  ]
}

Wichtig:
- Gib NUR das JSON zurück, keine zusätzlichen Erklärungen
- Analysiere die Quoten im Branchenvergleich (typische Kaltakquise-Conversion liegt bei 2-5%)
- Berücksichtige saisonale Faktoren wenn relevant
- Gib konkrete, umsetzbare Empfehlungen`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Du bist ein deutscher Vertriebsexperte. Antworte immer auf Deutsch und nur im angeforderten JSON-Format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to get AI analysis' })
      };
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content;

    if (!aiResponse) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Empty response from AI' })
      };
    }

    // Parse the JSON response
    let analysis;
    try {
      // Remove potential markdown code blocks
      const cleanedResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to parse AI response' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ analysis })
    };

  } catch (error) {
    console.error('AI Analysis error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal server error' })
    };
  }
};
