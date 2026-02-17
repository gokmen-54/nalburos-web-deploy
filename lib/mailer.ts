type SendResetMailInput = {
  to: string;
  resetLink: string;
};

type SendResetMailResult = {
  delivered: boolean;
  reason?: string;
};

export async function sendPasswordResetMail(input: SendResetMailInput): Promise<SendResetMailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESET_FROM_EMAIL?.trim();

  if (!apiKey || !from) {
    return {
      delivered: false,
      reason: "RESEND_API_KEY veya RESET_FROM_EMAIL eksik"
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: "NalburOS Sifre Sifirlama",
      html: `
        <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5">
          <h2>NalburOS</h2>
          <p>Sifrenizi yenilemek icin asagidaki baglantiya tiklayin:</p>
          <p><a href="${input.resetLink}">${input.resetLink}</a></p>
          <p>Baglanti 30 dakika gecerlidir.</p>
        </div>
      `
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      delivered: false,
      reason: `Mail gonderimi basarisiz: ${errorText}`
    };
  }

  return { delivered: true };
}
