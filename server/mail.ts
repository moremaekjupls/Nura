/** Transactional email via Resend (https://resend.com/docs/api-reference/emails/send-email). */

export interface Mailer {
  send(msg: { to: string; subject: string; html: string; text: string }): Promise<void>;
}

export function resendMailer(apiKey: string, from: string, fetchImpl: typeof fetch = fetch): Mailer {
  return {
    async send({ to, subject, html, text }) {
      const res = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, html, text }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
    },
  };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function resetEmail(link: string, lang: 'ru' | 'uz') {
  const t =
    lang === 'uz'
      ? {
          subject: 'Nura: parolni tiklash',
          title: 'Parolni tiklash',
          body: 'Nura hisobingiz uchun parolni tiklash soʻralgan. Yangi parol oʻrnatish uchun tugmani bosing. Havola 1 soat amal qiladi.',
          button: 'Yangi parol oʻrnatish',
          ignore: 'Agar buni siz soʻramagan boʻlsangiz, xatni eʼtiborsiz qoldiring — parolingiz oʻzgarmaydi.',
        }
      : {
          subject: 'Nura: восстановление пароля',
          title: 'Восстановление пароля',
          body: 'Кто-то запросил сброс пароля для вашего аккаунта Nura. Нажмите кнопку, чтобы задать новый. Ссылка действует 1 час.',
          button: 'Задать новый пароль',
          ignore: 'Если это были не вы, просто проигнорируйте письмо — пароль не изменится.',
        };
  const html = `<!doctype html><html><body style="margin:0;background:#F4F1EB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1C1F1D">
<div style="max-width:480px;margin:0 auto;padding:32px 20px">
<div style="background:#fff;border-radius:24px;padding:28px 24px">
<div style="font-size:22px;font-weight:700;margin-bottom:12px">${t.title}</div>
<p style="font-size:16px;line-height:1.5;margin:0 0 24px">${t.body}</p>
<a href="${esc(link)}" style="display:inline-block;background:#4F6B53;color:#fff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 24px;border-radius:999px">${t.button}</a>
<p style="font-size:13px;line-height:1.5;color:#5E655F;margin:24px 0 0">${t.ignore}</p>
</div>
<p style="font-size:12px;color:#5E655F;text-align:center;margin-top:16px">Nura</p>
</div></body></html>`;
  const text = `${t.title}\n\n${t.body}\n\n${link}\n\n${t.ignore}`;
  return { subject: t.subject, html, text };
}
