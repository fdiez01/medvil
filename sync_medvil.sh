#!/bin/bash

# --- CONFIGURATION ---
USER_HOME="/Users/fdiez"
# Le script cherche l'archive directement dans le répertoire du projet.
ZIP_SOURCE="$USER_HOME/medvil/medvil.zip" 
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
    echo -e "${RED}❌ Erreur : Le fichier medvil.zip est introuvable à la racine du projet (${REPO_DIR}).${NC}"
    echo "   -> Veuillez déplacer manuellement l'archive ici avant de continuer."
    exit 1
fi

# 2. NETTOYAGE PRÉALABLE
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# 3. EXTRACTION
echo -e "📦 Décompression de l'archive..."
# Nous faisons l'extraction sans messages d'avertissement avec -q
if ! unzip -q "$ZIP_SOURCE" -d "$TEMP_DIR"; then
    echo -e "${RED}❌ Erreur d'extraction. Le fichier ZIP est peut-être corrompu.${NC}"
    exit 1
fi

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

# Nous supprimons les fichiers du répertoire TEMPORAIRE
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

# On s'assure que le ZIP est bien ignoré par Git pour ne pas surcharger le dépôt
if ! grep -q "medvil.zip" .gitignore; then
    echo "medvil.zip" >> .gitignore
    echo "   - Ajout de medvil.zip à .gitignore."
fi

# On vérifie s'il y a des changements (incluant le .gitignore si modifié)
if [[ `git status --porcelain` ]]; then
  git add .
  git commit -m "feat(ai-studio): Sync latest changes from zip archive"
  git push
  echo -e "${GREEN}🎉 Succès ! Le déploiement Netlify devrait démarrer.${NC}"
  
  # Nettoyage
  rm "$ZIP_SOURCE" # Supprime le ZIP du dossier de projet (maintenant que le .gitignore le protège)
  rm -rf "$TEMP_DIR"
  echo "   - Archive medvil.zip nettoyée."
else
  echo -e "${YELLOW}Aucun changement détecté. Rien à pousser.${NC}"
fi