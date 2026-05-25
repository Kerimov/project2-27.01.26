#!/usr/bin/env bash
# Подготовка Ollama для проекта (модели из .env.local)
set -euo pipefail

echo "Проверка Ollama..."
if ! command -v ollama >/dev/null 2>&1; then
  echo "Установите Ollama: https://ollama.com/download"
  exit 1
fi

if ! curl -sf http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  echo "Запустите в отдельном терминале: ollama serve"
  echo "Затем снова выполните этот скрипт."
  exit 1
fi

echo "Скачивание моделей проекта..."
ollama pull llama3.2
ollama pull llava

echo "Готово. В .env.local должно быть:"
echo "  OLLAMA_DISABLED=false"
echo "  OLLAMA_MODEL=llama3.2"
echo "  OLLAMA_VISION_MODEL=llava"
echo ""
echo "Переключение модели: /admin/settings → Ollama Llama 3.2"
