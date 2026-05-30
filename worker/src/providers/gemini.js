/**
 * Gemini Provider — adapter para a API Generative Language (Google AI Studio).
 *
 * Usa modelo gemini-2.5-flash (multimodal, custo baixo).
 * Trocavel: implementar OpenAIProvider/AnthropicProvider com a mesma
 * interface (analyzePhoto / analyzeText) e mudar 1 linha no index.js.
 */

import { SYSTEM_PROMPT_PT_BR, userPromptPhoto, userPromptText } from '../prompts.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiProvider {
  constructor(env) {
    if (!env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY ausente no Worker');
    }
    this.apiKey = env.GEMINI_API_KEY;
    this.model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  }

  async analyzePhoto(base64Image, mimeType, context) {
    const userText = userPromptPhoto(context);
    const body = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT_PT_BR }] },
      contents: [
        {
          role: 'user',
          parts: [
            { text: userText },
            { inlineData: { mimeType, data: base64Image } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    };

    return this._callAndParse(body);
  }

  async analyzeText(text, context) {
    const userText = userPromptText(text, context);
    const body = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT_PT_BR }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    };

    return this._callAndParse(body);
  }

  async _callAndParse(body) {
    const url = `${API_BASE}/${this.model}:generateContent?key=${this.apiKey}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`Gemini ${resp.status}: ${txt.slice(0, 200)}`);
    }

    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      throw new Error('Gemini retornou resposta vazia');
    }

    // Garante JSON valido mesmo se a IA escapar com markdown
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      throw new Error(`Gemini retornou JSON invalido: ${cleaned.slice(0, 200)}`);
    }

    // Normaliza estrutura esperada
    parsed.alimentos = Array.isArray(parsed.alimentos) ? parsed.alimentos : [];
    parsed.totais = parsed.totais || this._computeTotals(parsed.alimentos);
    parsed.confianca = parsed.confianca || 'media';
    return parsed;
  }

  _computeTotals(alimentos) {
    const sum = (k) =>
      alimentos.reduce((acc, a) => acc + (Number(a?.[k]) || 0), 0);
    return {
      kcal: Math.round(sum('kcal')),
      proteina: +sum('proteina').toFixed(1),
      carbo: +sum('carbo').toFixed(1),
      gordura: +sum('gordura').toFixed(1),
    };
  }
}
