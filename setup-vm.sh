#!/bin/bash
# =============================================================================
# setup-vm.sh — Provisionamento da VM GCP para o jujuris-back
# Testado em: Debian 12 (Bookworm)
# Uso: sudo bash setup-vm.sh
# =============================================================================
set -euo pipefail

APP_USER="jujuris"
APP_DIR="/opt/jujuris-back"
SERVICE_NAME="jujuris-back"

echo "===> [1/7] Atualizando pacotes..."
apt-get update -y && apt-get upgrade -y

echo "===> [2/7] Instalando dependências do sistema..."
apt-get install -y \
  curl \
  git \
  ca-certificates \
  gnupg \
  chromium \
  chromium-sandbox \
  fonts-liberation \
  libnss3 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libxkbcommon0 \
  libgbm1 \
  --no-install-recommends

echo "===> [3/7] Instalando Node.js 20 (via NodeSource)..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v && npm -v

echo "===> [4/7] Criando usuário da aplicação..."
if ! id "$APP_USER" &>/dev/null; then
  useradd --system --shell /bin/bash --create-home "$APP_USER"
  echo "Usuário '$APP_USER' criado."
else
  echo "Usuário '$APP_USER' já existe, pulando."
fi

echo "===> [5/7] Configurando diretório da aplicação..."
mkdir -p "$APP_DIR"
chown "$APP_USER:$APP_USER" "$APP_DIR"

echo ""
echo "======================================================================"
echo " PRÓXIMO PASSO MANUAL: faça upload ou clone o projeto."
echo ""
echo " Opção A — clonar do GitHub (se o repositório for público/privado com token):"
echo "   sudo -u $APP_USER git clone https://github.com/SEU_USUARIO/jujuris-back.git $APP_DIR"
echo ""
echo " Opção B — copiar da sua máquina local (rode no seu terminal local):"
echo "   gcloud compute scp --recurse ./jujuris-back/* $APP_USER@NOME_DA_VM:$APP_DIR/ --zone=southamerica-east1-b"
echo ""
echo " Depois de copiar os arquivos, continue com:"
echo "   sudo bash $APP_DIR/setup-vm.sh --install-app"
echo "======================================================================"
echo ""

# Se passado o argumento --install-app, continua com build e serviço
if [[ "${1:-}" == "--install-app" ]]; then
  echo "===> [6/7] Instalando dependências Node e fazendo build..."

  if [[ ! -f "$APP_DIR/.env" ]]; then
    echo "ERRO: Arquivo $APP_DIR/.env não encontrado."
    echo "Crie o .env com base no .env.example antes de continuar."
    exit 1
  fi

  sudo -u "$APP_USER" bash -c "
    cd $APP_DIR
    npm ci --omit=dev
    npm run build
  "

  echo "===> [7/7] Instalando e habilitando o serviço systemd..."

  cp "$APP_DIR/jujuris-back.service" "/etc/systemd/system/$SERVICE_NAME.service"
  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME"
  systemctl restart "$SERVICE_NAME"
  systemctl status "$SERVICE_NAME" --no-pager

  echo ""
  echo "======================================================================"
  echo " Deploy concluído!"
  echo " API rodando na porta 3001."
  echo ""
  echo " Comandos úteis:"
  echo "   sudo systemctl status $SERVICE_NAME"
  echo "   sudo journalctl -u $SERVICE_NAME -f"
  echo "   sudo systemctl restart $SERVICE_NAME"
  echo "======================================================================"
fi
