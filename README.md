# 💬 Chat Socket.io - Application de Chat en Temps Réel

Une application de chat moderne et complète développée avec Node.js, Express et Socket.io. Profitez de conversations en temps réel avec support multi-salles, messages privés et indicateurs de frappe.

![Node.js](https://img.shields.io/badge/Node.js-v14+-green)
![Socket.io](https://img.shields.io/badge/Socket.io-v4.8.1-blue)
![License](https://img.shields.io/badge/license-ISC-blue)

## Fonctionnalités

- **Chat en temps réel** - Messages instantanés avec Socket.io
- **Multi-salles** - Créez et rejoignez différentes salles de discussion
- **Liste des utilisateurs** - Voyez qui est connecté en temps réel
- **Messages privés** - Envoyez des messages privés aux utilisateurs
- **Indicateur de frappe** - Voyez quand les autres utilisateurs tapent
- **Sécurité** - Protection XSS et rate limiting anti-spam
- **Historique** - Les nouveaux utilisateurs voient les 100 derniers messages
- **Interface moderne** - Design responsive et élégant
- **Notifications** - Alertes pour les événements importants
- **Persistance** - Sauvegarde du nom d'utilisateur dans le navigateur

##📋 Prérequis

Avant de commencer, assurez-vous d'avoir installé :

- **Node.js** (version 14 ou supérieure) - [Télécharger Node.js](https://nodejs.org/)
- **npm** (généralement inclus avec Node.js)
- **Git** (optionnel, pour cloner le projet)

Pour vérifier vos installations :

```bash
node --version   # Doit afficher v14.0.0 ou supérieur
npm --version    # Doit afficher une version de npm
```

## Installation Rapide

### Option 1 : Installation Standard

1. **Cloner le dépôt** (ou télécharger le ZIP)

```bash
git clone https://github.com/Nolan-Ar/Chat-Socket.io.git
cd Chat-Socket.io
```

2. **Installer les dépendances**

```bash
npm install
```

3. **Lancer l'application**

```bash
npm start
```

4. **Ouvrir dans le navigateur**

Accédez à [http://localhost:3000](http://localhost:3000)

C'est tout ! L'application est prête à être utilisée.

### Option 2 : Installation avec Nodemon (Développement)

Pour le développement avec rechargement automatique :

```bash
npm install
npm run dev
```

## Scripts Disponibles

```bash
npm start          # Lance le serveur en mode production
npm run dev        # Lance le serveur avec Nodemon (rechargement auto)
npm test           # Exécute les tests (à configurer)
```

## Configuration

### Variables d'Environnement

Vous pouvez personnaliser le port du serveur avec une variable d'environnement :

```bash
PORT=3000 npm start
```

Ou créez un fichier `.env` à la racine du projet :

```env
PORT=3000
```

### Personnalisation du CORS

Par défaut, le CORS est configuré pour accepter toutes les origines (`*`). En production, modifiez `index.js` ligne 14 pour restreindre l'accès :

```javascript
const io = require("socket.io")(http, {
    cors: {
        origin: "https://votre-domaine.com",  // Remplacez par votre domaine
        methods: ["GET", "POST"]
    }
});
```

## Utilisation

### Première Connexion

1. Ouvrez l'application dans votre navigateur
2. Entrez un nom d'utilisateur (2-20 caractères)
3. Sélectionnez une salle de chat
4. Cliquez sur "Rejoindre le chat"

### Salles Disponibles

**Général** - Discussion générale
**Gaming** - Pour les gamers
**Tech** - Discussions techniques
**Musique** - Parlez musique
**Random** - Discussions aléatoires

### Fonctionnalités Avancées

**Changer de salle** : Cliquez sur une salle dans le panneau de gauche

**Message privé** : Cliquez sur un utilisateur dans la liste de droite

**Indicateur de frappe** : Tapez un message pour que les autres voient que vous écrivez

**Envoi rapide** : Appuyez sur `Entrée` pour envoyer (Shift+Entrée pour nouvelle ligne)

## Structure du Projet

```
Chat-Socket.io/
├── index.js              # Serveur Node.js + logique Socket.io
├── index.html            # Interface utilisateur (HTML + CSS + JS)
├── package.json          # Dépendances et configuration
├── package-lock.json     # Verrouillage des versions
├── .env.example          # Exemple de configuration
├── .gitignore            # Fichiers à ignorer par Git
└── README.md             # Ce fichier
```

## Technologies Utilisées

### Backend

- **Node.js** - Environnement d'exécution JavaScript
- **Express.js** - Framework web minimaliste
- **Socket.io** - Communication bidirectionnelle en temps réel
- **HTTP** - Serveur HTTP natif de Node.js

### Frontend

- **HTML5** - Structure de la page
- **CSS3** - Stylisation moderne avec variables CSS
- **JavaScript ES6+** - Logique client
- **Socket.io Client** - Client Socket.io

## Sécurité

L'application implémente plusieurs mesures de sécurité :

- **Protection XSS** : Tous les inputs utilisateurs sont sanitisés
- **Rate Limiting** : Maximum 10 messages par 10 secondes par utilisateur
- **Validation** : Validation des noms d'utilisateur et messages
- **Limitation de taille** : Messages limités à 500 caractères
- **Échappement HTML** : Prévention des injections de code

## Dépannage

### Le serveur ne démarre pas

```bash
# Vérifiez que le port 3000 n'est pas déjà utilisé
lsof -i :3000

# Ou changez de port
PORT=3001 npm start
```

### Erreur "Cannot find module"

```bash
# Réinstallez les dépendances
rm -rf node_modules package-lock.json
npm install
```

### Les messages ne s'affichent pas

- Vérifiez la console du navigateur (F12)
- Vérifiez que le serveur est bien lancé
- Essayez de rafraîchir la page (Ctrl+R ou Cmd+R)

### Problèmes de connexion

- Vérifiez votre pare-feu
- Assurez-vous que WebSocket est supporté par votre navigateur
- Essayez en navigation privée pour éliminer les problèmes de cache

## Développement

### Ajouter une nouvelle salle

Modifiez `index.html` ligne 773-779 :

```html
<select id="room-select">
    <option value="general">🌍 Général</option>
    <option value="nouvelle-salle">🆕 Nouvelle Salle</option>
    <!-- Ajoutez vos salles ici -->
</select>
```

### Modifier le rate limiting

Dans `index.js`, lignes 37-38 :

```javascript
const RATE_LIMIT_MAX = 10;        // Nombre de messages
const RATE_LIMIT_WINDOW = 10000;  // Période en millisecondes
```

### Changer le nombre de messages historiques

Dans `index.js`, ligne 138 :

```javascript
if (history.length >= 100) {  // Changez 100 par votre valeur
    history.shift();
}
```

## Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## Licence

Ce projet est sous licence ISC. Voir le fichier `package.json` pour plus de détails.

## Auteur

**Nolan-Ar**

- GitHub: [@Nolan-Ar](https://github.com/Nolan-Ar)
- Projet: [Chat-Socket.io](https://github.com/Nolan-Ar/Chat-Socket.io)

## Remerciements

- Socket.io pour leur excellente bibliothèque
- La communauté Node.js
- Tous les contributeurs du projet

## Support

Si vous rencontrez des problèmes :

1. Consultez la section [Dépannage](#-dépannage)
2. Vérifiez les [Issues](https://github.com/Nolan-Ar/Chat-Socket.io/issues) existantes
3. Créez une nouvelle issue si nécessaire

---

Si vous aimez ce projet, n'hésitez pas à lui donner une étoile sur GitHub !

