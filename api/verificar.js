export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: "JSON inválido" }); }
  }

  const { imagen, tipo } = body || {};
  if (!imagen) return res.status(400).json({ error: "Falta imagen" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key no configurada en Vercel" });

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

Analiza esta foto y responde SOLO con JSON válido, sin markdown:

{
  "aprobado": true o false,
  "descripcion": "descripción breve en 1 frase",
  "severidad": "Leve | Moderada | Grave | Muy Grave",
  "motivo_rechazo": "razón si fue rechazada, vacío si aprobada"
}

Reglas:
- aprobado TRUE: foto muestra claramente basura, residuos o escombros en espacio público
- aprobado FALSE: foto borrosa, sin basura visible, selfie, pantalla, o irrelevante
- Tipo reportado: "${tipo || 'basura general'}"
- Si hay duda, rechaza`
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic error:", response.status, errText);
      return res.status(502).json({ error: "Error al contactar IA", detalle: errText });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "{}";

    let resultado;
    try {
      resultado = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch {
      return res.status(500).json({ error: "Respuesta IA inválida", raw: text });
    }

    return res.status(200).json(resultado);

  } catch (err) {
    console.error("Error interno:", err.message);
    return res.status(500).json({ error: "Error interno", mensaje: err.message });
  }
}
