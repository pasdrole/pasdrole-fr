# PasDrôle.fr — Marche à suivre pour la mise en ligne

## Ce que contient ce projet

Un vrai projet React (Vite), câblé sur ta base Supabase :
- Site public (accueil, classement, fiches humoristes)
- Connexion / inscription (pseudo + email)
- Notation multi-critères et avis, **un par compte et par humoriste, modifiables**
- Panneau admin (visible uniquement si ton compte a le rôle `admin`)

## Étape 1 — Te rendre admin

Tu peux faire ça **sans avoir lancé le site**, directement dans l'interface Supabase :

**1. Créer ton compte utilisateur**
- Supabase → menu de gauche → **Authentication** → onglet **Users**
- Bouton **Add user** (en haut à droite) → **Create new user**
- Renseigne ton email et un mot de passe
- Coche **Auto Confirm User** (évite d'avoir à cliquer sur un lien de confirmation reçu par mail)
- **Create user**

**2. Copier ton identifiant**
- Clique sur la ligne de l'utilisateur que tu viens de créer
- Copie la valeur **UID** (une longue chaîne du type `a1b2c3d4-...`)

**3. Créer ton profil avec le rôle admin**
- **Table Editor** → table **profiles** → bouton **Insert** → **Insert row**
- Remplis :
  - `id` → colle le UID copié à l'étape 2
  - `pseudo` → ton pseudo
  - `role` → tape `admin`
- **Save**

Ton compte est prêt et déjà admin. Une fois le site en ligne (étapes suivantes), connecte-toi avec cet email/mot de passe et le lien "Admin" apparaîtra dans le menu.

## Étape 2 — Tester en local (optionnel mais recommandé)

Il te faut [Node.js](https://nodejs.org) installé (version 18 ou plus).

```bash
cd pasdrole-app
npm install
npm run dev
```

Ouvre l'adresse affichée (généralement `http://localhost:5173`). Le site tourne déjà connecté à ta vraie base Supabase.

## Étape 3 — Mettre le code sur GitHub

1. Crée un compte sur [github.com](https://github.com) si tu n'en as pas
2. Crée un nouveau dépôt (bouton vert "New") → nomme-le `pasdrole-fr` → ne coche aucune case (pas de README, pas de .gitignore) → **Create repository**
3. Sur ta machine, dans le dossier du projet :

```bash
git init
git add .
git commit -m "Premier import du site PasDrôle.fr"
git branch -M main
git remote add origin https://github.com/TON-PSEUDO/pasdrole-fr.git
git push -u origin main
```

(Remplace `TON-PSEUDO` par ton pseudo GitHub — l'adresse exacte est affichée sur la page du dépôt vide que tu viens de créer.)

## Étape 4 — Déployer sur Vercel

1. Va sur [vercel.com](https://vercel.com) → **Sign up** → connecte-toi avec ton compte GitHub
2. **Add New → Project** → sélectionne le dépôt `pasdrole-fr`
3. Vercel détecte automatiquement que c'est un projet Vite — ne change rien aux réglages par défaut
4. **Avant de cliquer sur Deploy**, ajoute les variables d'environnement (section "Environment Variables") :
   - `VITE_SUPABASE_URL` → `https://gltyvhjhormviwkpjrkw.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` → ta clé anon (celle que tu m'as donnée)
5. Clique **Deploy**

Après 1-2 minutes, ton site est en ligne sur une adresse type `pasdrole-fr.vercel.app`.

## Étape 5 — Brancher ton nom de domaine

1. Achète `pasdrole.fr` chez un registrar (OVH, LWS, Gandi...) si ce n'est pas déjà fait
2. Dans Vercel : **Project → Settings → Domains** → ajoute `pasdrole.fr`
3. Vercel te donne des enregistrements DNS à copier (généralement un enregistrement de type `A` ou `CNAME`)
4. Va chez ton registrar → zone DNS de `pasdrole.fr` → colle les enregistrements donnés par Vercel
5. Attends la propagation (de quelques minutes à quelques heures)

## Ensuite, à chaque changement

Toute future modification du code se déploie automatiquement : tu modifies les fichiers, puis :

```bash
git add .
git commit -m "Description du changement"
git push
```

Vercel redéploie tout seul en 1-2 minutes.

## Rappels importants

- La clé `anon` dans `.env` est **publique par conception** — la vraie protection vient des règles de sécurité (Row Level Security) posées dans `supabase-schema.sql`. Ne jamais utiliser la clé `service_role` de Supabase dans ce code.
- Les photos (humoristes, logo) restent en emplacement réservé tant que tu n'as pas ajouté d'URLs dans la colonne `photo_url` de la table `comics` (directement dans Supabase, ou via une future fonctionnalité d'upload).
