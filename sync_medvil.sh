#!/bin/bash

# --- CONFIGURATION ---
USER_HOME="/Users/fdiez" # Votre dossier utilisateur
ZIP_SOURCE="$USER_HOME/Downloads/medvil.zip"
REPO_DIR="$USER_HOME/medvil"
TEMP_DIR="/tmp/medvil_extract"

# --- COULEURS POUR LE TERMINAL ---
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Démarrage de la synchronisation AI Studio -> Local...${NC}"

# 1. VÉRIFICATION
if [ ! -f "$ZIP_SOURCE" ]; then
    echo -e "${RED}❌ Erreur : Le fichier medvil.zip est introuvable dans Downloads.${NC}"
    echo "   -> Avez-vous téléchargé l'archive depuis AI Studio ?"
    exit 1
fi

# 2. NETTOYAGE PRÉALABLE
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# 3. EXTRACTION
echo -e "📦 Décompression de l'archive..."
unzip -q "$ZIP_SOURCE" -d "$TEMP_DIR"

# 4. CHIRURGIE : SUPPRESSION DE LA "ZONE ROUGE"
# On supprime les fichiers de config Google qui casseraient Netlify
echo -e "${YELLOW}🛡️  Suppression des fichiers 'Zone Rouge' (Config Google)...${NC}"

declare -a RED_ZONE=(
    "package.json"
    "package-lock.json"
    "index.html"
    "vite.config.ts"
    "vite.config.js"
    "tsconfig.json"
    "tsconfig.node.json"
    ".gitignore"
    "README.md"
    "tailwind.config.js"
    "tailwind.config.cjs"
    "postcss.config.js"
    "postcss.config.cjs"
    ".nvmrc"
    "index.css" 
)

# Note sur index.css : On le supprime car votre version locale contient l'import v4 spécial
# AI Studio risque de remettre tout le CSS brut.

for file in "${RED_ZONE[@]}"; do
    if [ -f "$TEMP_DIR/$file" ]; then
        rm "$TEMP_DIR/$file"
        echo "   - Supprimé : $file"
    fi
done

# 5. GREFFE (COPIE)
echo -e "${GREEN}✅ Copie des fichiers de jeu (src/) vers le repository...${NC}"
# On copie tout le contenu restant du dossier temporaire vers votre repo
cp -R "$TEMP_DIR/"* "$REPO_DIR/"

# 6. COMMIT & PUSH
echo -e "git ☁️  Envoi vers GitHub & Netlify..."
cd "$REPO_DIR"

# On vérifie s'il y a des changements
if [[ `git status --porcelain` ]]; then
  git add .
  git commit -m "feat(ai-studio): Sync latest changes from zip archive"
  git push
  echo -e "${GREEN}🎉 Succès ! Le déploiement Netlify devrait démarrer.${NC}"
  
  # Optionnel : Supprimer le zip après succès pour éviter les confusions futures
  rm "$ZIP_SOURCE"
  echo "   - Archive medvil.zip supprimée de Downloads."
else
  echo -e "${YELLOW}Aucun changement détecté. Rien à pousser.${NC}"
fi