const fetch = require('node-fetch');

exports.handler = async (event) => {
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
    const { stats, zeitverlauf, compareStats, perUser, dateRange, context } = JSON.parse(event.body);

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

    // System-Prompt
    const systemPrompt = `Du bist ein erfahrener Vertriebsanalyst für B2B-Kaltakquise im deutschen Mittelstand. Dein Kunde ist ein Vertriebsteam, das Immobilienmakler und Sachverständige als Kunden akquiriert. Du analysierst deren Kaltakquise-KPIs und gibst datenbasierte Einschätzungen.

Regeln:
- Antworte ausschließlich auf Deutsch.
- Antworte ausschließlich mit validem JSON — kein Markdown, keine Backticks, kein Fließtext.
- Basiere deine Aussagen nur auf den übergebenen Zahlen. Wenn die Daten für eine Aussage nicht ausreichen, lass sie weg statt zu raten.
- Vermeide Floskeln wie "Gute Arbeit!" oder "Weiter so!". Sei sachlich, konkret und direkt.
- Gib Quoten immer als gerundete Prozentwerte an.
- Vergleiche die Quoten mit diesen Branchen-Benchmarks für Kaltakquise an Immobilienmakler:
    - Erreichquote: 25–35 % ist durchschnittlich, >40 % ist stark
    - Beratungsgesprächquote (von Erreichten): 8–15 % ist durchschnittlich, >20 % ist stark
    - Kein-Interesse-Quote (von Erreichten): <50 % ist gut, >65 % ist problematisch`;

    // User-Prompt dynamisch aufbauen
    const userName = context?.userName || 'Unbekannt';
    const isTeam = context?.isTeam || false;
    const teamSize = context?.teamSize || 0;

    let userPrompt = `Analysiere die Kaltakquise-Performance.

ANSICHT: ${userName}${isTeam ? ` (${teamSize} Vertriebler)` : ''}
ZEITRAUM: ${dateRange || 'Aktueller Zeitraum'}

KENNZAHLEN:
- Einwahlen: ${stats.einwahlen || 0}
- Erreicht: ${stats.erreicht || 0} (${(stats.erreichQuote || 0).toFixed(1)}% Erreichquote)
- Beratungsgespräch: ${stats.beratungsgespraech || 0} (${(stats.beratungsgespraechQuote || 0).toFixed(1)}% der Erreichten)
- Unterlagen/WV: ${stats.unterlagen || 0} (${(stats.unterlagenQuote || 0).toFixed(1)}% der Erreichten)
- Kein Interesse: ${stats.keinInteresse || 0} (${(stats.keinInteresseQuote || 0).toFixed(1)}% der Erreichten)
- Nicht erreicht: ${stats.nichtErreicht || 0}`;

    // Zeitverlauf hinzufügen wenn >= 3 Datenpunkte
    const hasVerlauf = zeitverlauf && zeitverlauf.length >= 3;
    if (hasVerlauf) {
      userPrompt += `

VERLAUF (${zeitverlauf.length} Datenpunkte, chronologisch):
${zeitverlauf.map(z => `  ${z.label}: ${z.count} Einwahlen`).join('\n')}`;
    }

    // Vergleichszeitraum hinzufügen wenn vorhanden
    if (compareStats && compareStats.summary) {
      const cs = compareStats.summary;
      userPrompt += `

VERGLEICHSZEITRAUM: ${compareStats.label || 'Vorperiode'}
- Einwahlen: ${cs.einwahlen || 0}
- Erreicht: ${cs.erreicht || 0} (${(cs.erreichQuote || 0).toFixed(1)}%)
- Beratungsgespräch: ${cs.beratungsgespraech || 0} (${(cs.beratungsgespraechQuote || 0).toFixed(1)}%)
- Kein Interesse: ${cs.keinInteresse || 0} (${(cs.keinInteresseQuote || 0).toFixed(1)}%)`;
    }

    // Team-Performance hinzufügen wenn Admin und Daten vorhanden
    if (perUser && perUser.length > 0) {
      userPrompt += `

TEAM-PERFORMANCE (Top ${perUser.length}):
${perUser.map(u => `  ${u.name}: ${u.einwahlen} Einwahlen, ${u.erreicht} erreicht, ${u.beratungsgespraech} BG`).join('\n')}`;
    }

    // JSON-Schema im Prompt
    userPrompt += `

Antworte mit folgendem JSON:
{
  "zusammenfassung": "2-3 Sätze: Was zeigen die Daten? Zentrale Stärke + zentrales Problem benennen. Keine Floskeln.",

  "insights": [
    {
      "titel": "Kurzer Fakt-Titel (max 8 Wörter)",
      "beschreibung": "1-2 Sätze. Konkreter Bezug auf die Zahlen, Vergleich mit Benchmark oder Vorperiode.",
      "typ": "positiv | neutral | negativ",
      "impact": "hoch | mittel | niedrig"
    }
  ]${hasVerlauf ? `,

  "trend": {
    "richtung": "steigend | fallend | stabil | schwankend",
    "beschreibung": "1 Satz: Was zeigt der Verlauf?"
  }` : ''},

  "empfehlungen": [
    {
      "text": "Konkrete, umsetzbare Handlung in 1 Satz.",
      "prioritaet": "hoch | mittel | niedrig"
    }
  ]
}

Liefere 2-4 Insights sortiert nach Impact. Liefere 2-3 Empfehlungen sortiert nach Priorität.${compareStats ? ' Beziehe dich explizit auf die Veränderung zwischen den Zeiträumen.' : ''}${perUser ? ' Erwähne Unterschiede zwischen den Vertrieblern.' : ''}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1500
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

    // Robustes JSON-Parsing
    let analysis;
    try {
      const cleaned = aiResponse
        .replace(/```json\n?/g, '').replace(/```\n?/g, '')
        .replace(/\/\/.*$/gm, '')           // Einzeilige Kommentare
        .replace(/,\s*([}\]])/g, '$1')      // Trailing Commas
        .trim();
      analysis = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse);
      // Fallback bei Parse-Fehler
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          analysis: {
            zusammenfassung: aiResponse.substring(0, 300).replace(/[{}"]/g, ''),
            insights: [],
            empfehlungen: []
          }
        })
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
