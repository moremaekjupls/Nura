# Nura на Oracle Cloud (Always Free)

Итог: одна бесплатная виртуальная машина, на ней приложение и Caddy (он сам получает и продлевает HTTPS-сертификат).
Время: 30–40 минут, большая часть — регистрация и создание машины.

## Быстрый путь: одна команда в Cloud Shell

В консоли Oracle нажмите значок **Cloud Shell** (`>_` вверху справа) и выполните:

```bash
curl -fsSL https://raw.githubusercontent.com/moremaekjupls/Nura/main/deploy/oci-launch.sh -o launch.sh && bash launch.sh
```

**Что делает скрипт:**
- спрашивает токен бота и ключи Gemini и Resend (любой можно пропустить);
- создаёт сеть, открывает порты;
- ищет свободную бесплатную ARM-машину во всех зонах, а если мест нет — берёт AMD Micro;
- создаёт машину, которая при первой загрузке сама ставит Docker и запускает Nura.

В конце скрипт покажет адрес приложения. Сама установка на машине занимает 5–15 минут. Если свободных машин нет нигде, запустите скрипт ещё раз позже. Повторный запуск безопасен.

Разделы ниже нужны, если хочется сделать всё вручную.

## 1. Аккаунт

1. Зарегистрируйтесь на oracle.com/cloud/free. Нужна банковская карта для проверки; деньги не списываются.
2. **Домашний регион выберите сразу и внимательно** — его нельзя сменить, и бесплатные машины создаются только в нём.
   Ближайшие к Узбекистану по задержке: Frankfurt, Stockholm, Dubai (Jeddah). Если бесплатных ARM-машин нет
   («Out of capacity»), чаще всего помогает другой Availability Domain или повтор позже.
3. **Рекомендую сразу перейти на Pay As You Go** (Billing → Upgrade). Always Free ресурсы остаются бесплатными,
   но Oracle перестаёт забирать «простаивающие» бесплатные машины — а маленькое приложение по их меркам почти всегда простаивает.
   Поставьте бюджет с уведомлением на $1, чтобы ничего не списалось случайно.

## 2. Машина

Compute → Instances → Create instance:
- **Image:** Canonical Ubuntu 24.04 (или 22.04). Не Oracle Linux — скрипт рассчитан на Ubuntu.
- **Shape:** Ampere → `VM.Standard.A1.Flex`, 1 OCPU и 6 GB памяти (с запасом; бесплатно до 4 OCPU / 24 GB).
  Если ARM недоступен — `VM.Standard.E2.1.Micro` (1 GB), скрипт сам добавит swap.
- **Networking:** создать VCN с публичной подсетью, **Assign a public IPv4 address — да**.
- **SSH keys:** «Generate a key pair» и скачайте **приватный ключ** — без него на сервер не зайти.

## 3. Открыть порты 80 и 443 в Oracle

Instance → Subnet → Security List (Default) → Add Ingress Rules — два правила:
- Source CIDR `0.0.0.0/0`, IP Protocol TCP, Destination Port `80`
- Source CIDR `0.0.0.0/0`, IP Protocol TCP, Destination Port `443`

(Файрвол внутри Ubuntu скрипт откроет сам.)

## 4. Установка

Зайдите на сервер (IP — на странице инстанса):

```bash
chmod 600 ~/Downloads/ssh-key-*.key
ssh -i ~/Downloads/ssh-key-*.key ubuntu@<IP>
```

На Windows можно так же в PowerShell (там есть ssh), или через PuTTY.

На сервере:

```bash
curl -fsSL https://raw.githubusercontent.com/moremaekjupls/Nura/main/deploy/setup.sh | bash
```

Скрипт поставит Docker, откроет порты, скачает код и создаст `~/nura/.env`.
В `.env` уже будет временный адрес вида `141-147-12-34.sslip.io` (бесплатный домен на ваш IP) и случайный `ADMIN_KEY`.

Впишите ключи:

```bash
nano ~/nura/.env      # TELEGRAM_BOT_TOKEN, GEMINI_API_KEY, RESEND_API_KEY, MAIL_FROM
bash ~/nura/deploy/update.sh
```

Через минуту приложение откроется по адресу из `APP_URL`. Бот настроится сам: вебхук, команды, кнопка меню.
Логи: `cd ~/nura && sudo docker compose logs -f app`.

## 5. Перенос данных с Railway (если нужны старые пользователи)

Старая версия отдаёт базу по ссылке с ключом (если сервис на Railway ещё запущен):

```bash
curl "https://<старый-адрес>.up.railway.app/api/admin/backup?key=<ADMIN_KEY из Railway>" -o calotrack.db
scp -i ~/Downloads/ssh-key-*.key calotrack.db ubuntu@<IP>:~/
ssh -i ~/Downloads/ssh-key-*.key ubuntu@<IP> 'bash ~/nura/deploy/restore.sh ~/calotrack.db'
```

Миграции применятся при запуске, пользователи, записи и сессии сохранятся.
Если Railway уже остановил сервис, данные можно достать, только оплатив один месяц Hobby ($5). Если пользователей почти нет, проще начать с чистой базы.

## 6. Свой домен (позже)

1. Купите домен (например, в .uz или любой другой зоне) и создайте A-запись на IP сервера.
2. В `~/nura/.env` поменяйте `DOMAIN` и `APP_URL` на него, выполните `bash ~/nura/deploy/update.sh`.
   Caddy получит новый сертификат, бот перерегистрирует вебхук на новый адрес.
3. Подтвердите домен в Resend — без этого письма сброса пароля уходят только на ваш собственный email.

## 7. Автодеплой из GitHub (по желанию)

Чтобы каждый пуш в `main` сам выкатывался на сервер:

1. На своём компьютере: `ssh-keygen -t ed25519 -f nura_deploy -N ""`.
2. Публичный ключ добавьте на сервер: `ssh -i <ключ-oracle> ubuntu@<IP> "cat >> ~/.ssh/authorized_keys" < nura_deploy.pub`.
3. GitHub → репозиторий → Settings → Secrets and variables → Actions → New repository secret:
   `ORACLE_HOST` = IP, `ORACLE_USER` = `ubuntu`, `ORACLE_SSH_KEY` = содержимое файла `nura_deploy` (приватного).

Без секретов workflow просто прогоняет тесты.

## Обслуживание

| Что | Команда на сервере |
| --- | --- |
| Обновить до последней версии | `bash ~/nura/deploy/update.sh` |
| Логи | `cd ~/nura && sudo docker compose logs -f app` |
| Перезапуск | `cd ~/nura && sudo docker compose restart` |
| Скачать бэкап базы к себе | `curl -H "X-Admin-Key: <ADMIN_KEY>" <APP_URL>/api/admin/backup -o nura.db` |

Приложение само делает снапшот базы раз в сутки и хранит 7 дней (в томе `nura-data`). Это защита от ошибок,
но не от потери машины — раз в неделю-две скачивайте бэкап к себе командой выше.
