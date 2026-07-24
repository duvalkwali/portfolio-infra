#!/bin/bash
# Run this on a fresh Ubuntu 24.04 droplet as root.
# Usage: ssh root@<DROPLET_IP> 'bash -s' < bootstrap.sh
set -euo pipefail

DEPLOY_USER="deploy"

echo "--- Creating deploy user ---"
if ! id "$DEPLOY_USER" &>/dev/null; then
    adduser --disabled-password --gecos "" "$DEPLOY_USER"
    usermod -aG sudo "$DEPLOY_USER"
    echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$DEPLOY_USER
fi

echo "--- Copying SSH key to deploy user ---"
mkdir -p /home/$DEPLOY_USER/.ssh
cp /root/.ssh/authorized_keys /home/$DEPLOY_USER/.ssh/authorized_keys
chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
chmod 700 /home/$DEPLOY_USER/.ssh
chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys

echo "--- Installing Docker ---"
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker $DEPLOY_USER
fi

echo "--- Configuring firewall ---"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "--- Hardening SSH ---"
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd

echo ""
echo "=============================================="
echo " DONE. Before closing this terminal:"
echo " Open a NEW terminal and confirm:"
echo "   ssh deploy@<THIS_IP>"
echo " If that works, root access is locked out"
echo " and you're ready for docker compose."
echo "=============================================="
