export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { imagen, tipo } = req.body;
  if (!imagen) return res.status(400).json({ error: "Falta imagen" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key no configurada" });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: imagen }
            },
            {
              type: "text",
              text: `Eres el verificador oficial de LIF, app chilena de reporte de basura ciudadana.

Analiza esta foto y responde SOLO con JSON válido, sin markdown ni texto adicional:

{
  "aprobado": true o false,
  "es_basura": true o false,
  "descripcion": "descripción breve en 1 frase",
  "severidad": "Leve | Moderada | Grave | Muy Grave",
  "motivo_rechazo": "razón si fue rechazada, vacío si aprobada"
}

Reglas estrictas:
- "aprobado" es TRUE solo si la foto muestra claramente basura, residuos, escombros o desechos en un espacio público o vía
- "aprobado" es FALSE si: la foto está muy borrosa, no se ve basura, es un selfie, es una foto de pantalla, es un paisaje sin basura, o no es relevante
- Tipo reportado: "${tipo || 'basura general'}"
- Sé estricto: si hay duda, rechaza`
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic error:", err);
      return res.status(500).json({ error: "Error al contactar IA" });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "{}";
    const resultado = JSON.parse(text.replace(/```json|```/g, "").trim());
    return res.status(200).json(resultado);

  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({
      aprobado: false,
      error: "Error interno al verificar foto"
    });
  }
}
