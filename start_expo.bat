@echo off
REM Переход в папку mobile рядом с этим батником
cd /d "%~dp0mobile"

REM Запуск Expo dev-сервера
npx expo start --android

REM Чтобы окно не закрывалось сразу после выхода
pause