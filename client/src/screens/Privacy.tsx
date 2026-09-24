import { ChevronLeft } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const RU = [
  ['Какие данные мы собираем', 'Email и пароль (пароль хранится только в виде хеша) или, при входе через Telegram, ваш Telegram ID и имя. По желанию: пол, год рождения, рост, вес, уровень активности и цель — чтобы посчитать норму калорий. Записи о еде, воде и весе.'],
  ['Зачем', 'Чтобы считать калории и БЖУ, показывать прогресс и не заставлять вводить одно и то же каждый раз. Рекламы, профилирования и продажи данных в Nura нет.'],
  ['Фото и описания блюд', 'Если вы пользуетесь распознаванием, фото или текст отправляются в Google Gemini для оценки калорийности. Nura не сохраняет фото: оно используется только на время запроса. Оценка ИИ приблизительная.'],
  ['Где хранятся данные', 'На сервере приложения (Railway) в базе данных, доступ к которой есть только у разработчика Nura. Сессия хранится в cookie или, внутри Telegram, в памяти приложения.'],
  ['Ваши права', 'В профиле можно скачать все свои данные и удалить аккаунт вместе со всеми записями — сразу и без писем. Вопросы: moremaekjupls@gmail.com.'],
  ['Оговорка', 'Nura — не медицинский сервис. Оценки калорий приблизительны и не заменяют консультацию врача или диетолога.'],
];
const UZ = [
  ['Qanday maʼlumotlarni yigʻamiz', 'Email va parol (parol faqat xesh koʻrinishida saqlanadi) yoki Telegram orqali kirganda Telegram ID va ismingiz. Ixtiyoriy: jins, tugʻilgan yil, boʻy, vazn, faollik va maqsad — kaloriya meʼyorini hisoblash uchun. Ovqat, suv va vazn yozuvlari.'],
  ['Nima uchun', 'Kaloriya va BJUni hisoblash, natijalarni koʻrsatish va bir narsani qayta-qayta kiritmaslik uchun. Nurada reklama, profillash va maʼlumot sotish yoʻq.'],
  ['Taom rasmlari va tavsiflari', 'Aniqlashdan foydalansangiz, rasm yoki matn kaloriyani baholash uchun Google Gemini xizmatiga yuboriladi. Nura rasmlarni saqlamaydi. SI bahosi taxminiy.'],
  ['Maʼlumotlar qayerda saqlanadi', 'Ilova serverida (Railway) maʼlumotlar bazasida, unga faqat Nura dasturchisi kira oladi.'],
  ['Huquqlaringiz', 'Profilda barcha maʼlumotlaringizni yuklab olish va hisobni barcha yozuvlar bilan darhol oʻchirish mumkin. Savollar: moremaekjupls@gmail.com.'],
  ['Eslatma', 'Nura tibbiy xizmat emas. Kaloriya baholari taxminiy va shifokor yoki dietolog maslahatini almashtirmaydi.'],
];

export default function Privacy() {
  const { t, lang } = useI18n();
  const sections = lang === 'uz' ? UZ : RU;
  return (
    <main className="screen plain fade-in">
      <button className="pill-btn glass" onClick={() => (history.length > 1 ? history.back() : (location.href = '/'))} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, paddingLeft: 8, marginBottom: 16 }}>
        <ChevronLeft size={20} aria-hidden /> Nura
      </button>
      <h1 className="large-title" style={{ marginBottom: 6 }}>{t('profile.privacy')}</h1>
      <p className="small muted" style={{ margin: 0 }}>24.09.2026</p>
      <article className="card pad prose" style={{ marginTop: 16 }}>
        {sections.map(([h, p]) => (
          <section key={h}>
            <h2>{h}</h2>
            <p>{p}</p>
          </section>
        ))}
      </article>
    </main>
  );
}
