// ============================================================================
// IMPORTS ET CONFIGURATION
// ============================================================================

// On instancie express pour créer l'application web
const app = require("express")();

// On crée le serveur HTTP qui va gérer les requêtes
const http = require("http").createServer(app);

// On instancie socket.io pour la communication en temps réel
// CORS configuré pour accepter toutes les origines (à restreindre en production)
const io = require("socket.io")(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// ============================================================================
// STRUCTURES DE DONNÉES POUR GÉRER L'ÉTAT DE L'APPLICATION
// ============================================================================

// Map pour stocker les utilisateurs connectés
// Clé: socket.id, Valeur: objet utilisateur {username, room, socketId}
const users = new Map();

// Map pour stocker l'historique des messages par salle
// Clé: nom de la salle, Valeur: tableau de messages
const messageHistory = new Map();

// Map pour le rate limiting (limitation du nombre de messages par utilisateur)
// Clé: socket.id, Valeur: tableau de timestamps
const rateLimitMap = new Map();

// Configuration du rate limiting: max 10 messages par 10 secondes
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 10000; // 10 secondes en millisecondes

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Sanitize l'entrée utilisateur pour prévenir les attaques XSS
 * Remplace les caractères HTML dangereux par leurs entités
 * @param {string} text - Le texte à nettoyer
 * @returns {string} - Le texte sécurisé
 */
function sanitizeInput(text) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;')
        .trim()
        .substring(0, 500); // Limite à 500 caractères
}

/**
 * Vérifie si un utilisateur a dépassé la limite de messages
 * @param {string} socketId - L'identifiant du socket
 * @returns {boolean} - true si la limite est dépassée
 */
function isRateLimited(socketId) {
    const now = Date.now();
    const timestamps = rateLimitMap.get(socketId) || [];

    // On filtre les timestamps qui sont dans la fenêtre temporelle
    const recentTimestamps = timestamps.filter(
        time => now - time < RATE_LIMIT_WINDOW
    );

    // On met à jour la map avec les timestamps récents
    rateLimitMap.set(socketId, recentTimestamps);

    // On retourne true si la limite est dépassée
    return recentTimestamps.length >= RATE_LIMIT_MAX;
}

/**
 * Ajoute un timestamp pour le rate limiting
 * @param {string} socketId - L'identifiant du socket
 */
function addRateLimitTimestamp(socketId) {
    const timestamps = rateLimitMap.get(socketId) || [];
    timestamps.push(Date.now());
    rateLimitMap.set(socketId, timestamps);
}

/**
 * Récupère la liste des utilisateurs dans une salle spécifique
 * @param {string} room - Le nom de la salle
 * @returns {Array} - Tableau des utilisateurs dans la salle
 */
function getUsersInRoom(room) {
    const usersInRoom = [];
    users.forEach((user, socketId) => {
        if (user.room === room) {
            usersInRoom.push({
                username: user.username,
                socketId: socketId
            });
        }
    });
    return usersInRoom;
}

/**
 * Vérifie si un nom d'utilisateur est déjà pris dans une salle
 * @param {string} username - Le nom d'utilisateur à vérifier
 * @param {string} room - La salle à vérifier
 * @returns {boolean} - true si le nom est disponible
 */
function isUsernameAvailable(username, room) {
    for (let [socketId, user] of users) {
        if (user.username === username && user.room === room) {
            return false;
        }
    }
    return true;
}

/**
 * Ajoute un message à l'historique d'une salle
 * @param {string} room - Le nom de la salle
 * @param {Object} message - L'objet message à stocker
 */
function addMessageToHistory(room, message) {
    if (!messageHistory.has(room)) {
        messageHistory.set(room, []);
    }
    const history = messageHistory.get(room);
    // On garde seulement les 100 derniers messages
    if (history.length >= 100) {
        history.shift();
    }
    history.push(message);
}

/**
 * Récupère l'historique des messages d'une salle
 * @param {string} room - Le nom de la salle
 * @returns {Array} - Tableau des messages
 */
function getMessageHistory(room) {
    return messageHistory.get(room) || [];
}

// ============================================================================
// ROUTES HTTP
// ============================================================================

// Route principale qui sert le fichier HTML
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});

// ============================================================================
// GESTION DES CONNEXIONS SOCKET.IO
// ============================================================================

// Événement déclenché lors d'une nouvelle connexion socket
io.on("connection", (socket) => {
    console.log(`[CONNEXION] Nouvelle connexion: ${socket.id}`);

    // ========================================================================
    // ÉVÉNEMENT: Rejoindre le chat (join)
    // ========================================================================
    /**
     * Gère l'arrivée d'un utilisateur dans une salle
     * Vérifie la validité du nom d'utilisateur et l'ajoute à la salle
     */
    socket.on("join", (data) => {
        try {
            // Validation et nettoyage des données
            const username = sanitizeInput(data.username);
            const room = sanitizeInput(data.room) || "general";

            // Vérification: le nom d'utilisateur ne doit pas être vide
            if (!username || username.length < 2) {
                socket.emit("error", {
                    message: "Le nom d'utilisateur doit contenir au moins 2 caractères"
                });
                return;
            }

            // Vérification: le nom d'utilisateur doit être unique dans la salle
            if (!isUsernameAvailable(username, room)) {
                socket.emit("error", {
                    message: "Ce nom d'utilisateur est déjà pris dans cette salle"
                });
                return;
            }

            // On fait rejoindre la salle à l'utilisateur
            socket.join(room);

            // On stocke les informations de l'utilisateur
            users.set(socket.id, {
                username: username,
                room: room,
                socketId: socket.id
            });

            console.log(`[JOIN] ${username} a rejoint la salle: ${room}`);

            // On envoie l'historique des messages au nouvel utilisateur
            const history = getMessageHistory(room);
            socket.emit("message_history", history);

            // On notifie tous les utilisateurs de la salle de l'arrivée
            const joinMessage = {
                type: "system",
                message: `${username} a rejoint le chat`,
                timestamp: Date.now(),
                room: room
            };
            io.to(room).emit("user_joined", joinMessage);

            // On envoie la liste mise à jour des utilisateurs à tous
            const usersInRoom = getUsersInRoom(room);
            io.to(room).emit("users_list", usersInRoom);

            // On confirme la connexion à l'utilisateur
            socket.emit("join_success", {
                username: username,
                room: room,
                usersCount: usersInRoom.length
            });

        } catch (error) {
            console.error("[ERREUR JOIN]", error);
            socket.emit("error", {
                message: "Erreur lors de la connexion au chat"
            });
        }
    });

    // ========================================================================
    // ÉVÉNEMENT: Envoi d'un message dans le chat
    // ========================================================================
    /**
     * Gère l'envoi d'un message par un utilisateur
     * Applique le rate limiting et diffuse le message à tous
     */
    socket.on("chat_message", (data) => {
        try {
            // Vérification: l'utilisateur doit être connecté
            const user = users.get(socket.id);
            if (!user) {
                socket.emit("error", {
                    message: "Vous devez d'abord rejoindre un salon"
                });
                return;
            }

            // Vérification: rate limiting pour éviter le spam
            if (isRateLimited(socket.id)) {
                socket.emit("error", {
                    message: "Vous envoyez trop de messages. Veuillez patienter."
                });
                return;
            }

            // Nettoyage et validation du message
            const message = sanitizeInput(data.message);
            if (!message || message.length === 0) {
                return; // On ignore les messages vides
            }

            // On enregistre le timestamp pour le rate limiting
            addRateLimitTimestamp(socket.id);

            // Construction de l'objet message complet
            const messageObject = {
                type: "user",
                username: user.username,
                message: message,
                timestamp: Date.now(),
                room: user.room,
                socketId: socket.id
            };

            console.log(`[MESSAGE] ${user.username} dans ${user.room}: ${message}`);

            // On ajoute le message à l'historique
            addMessageToHistory(user.room, messageObject);

            // On diffuse le message à tous les utilisateurs de la salle
            io.to(user.room).emit("received_message", messageObject);

        } catch (error) {
            console.error("[ERREUR MESSAGE]", error);
            socket.emit("error", {
                message: "Erreur lors de l'envoi du message"
            });
        }
    });

    // ========================================================================
    // ÉVÉNEMENT: Message privé
    // ========================================================================
    /**
     * Gère l'envoi d'un message privé entre deux utilisateurs
     */
    socket.on("private_message", (data) => {
        try {
            const sender = users.get(socket.id);
            if (!sender) {
                socket.emit("error", {
                    message: "Vous devez d'abord rejoindre un salon"
                });
                return;
            }

            // Nettoyage des données
            const message = sanitizeInput(data.message);
            const targetSocketId = data.targetSocketId;

            // Vérification du destinataire
            const recipient = users.get(targetSocketId);
            if (!recipient) {
                socket.emit("error", {
                    message: "Destinataire introuvable"
                });
                return;
            }

            // Vérification: rate limiting
            if (isRateLimited(socket.id)) {
                socket.emit("error", {
                    message: "Vous envoyez trop de messages. Veuillez patienter."
                });
                return;
            }

            addRateLimitTimestamp(socket.id);

            // Construction du message privé
            const privateMessage = {
                type: "private",
                from: sender.username,
                to: recipient.username,
                message: message,
                timestamp: Date.now(),
                fromSocketId: socket.id,
                toSocketId: targetSocketId
            };

            console.log(`[PRIVÉ] ${sender.username} -> ${recipient.username}: ${message}`);

            // On envoie le message au destinataire
            io.to(targetSocketId).emit("private_message_received", privateMessage);

            // On confirme l'envoi à l'expéditeur
            socket.emit("private_message_sent", privateMessage);

        } catch (error) {
            console.error("[ERREUR MESSAGE PRIVÉ]", error);
            socket.emit("error", {
                message: "Erreur lors de l'envoi du message privé"
            });
        }
    });

    // ========================================================================
    // ÉVÉNEMENT: Indicateur de frappe (typing)
    // ========================================================================
    /**
     * Diffuse l'information qu'un utilisateur est en train de taper
     */
    socket.on("typing", (data) => {
        const user = users.get(socket.id);
        if (user) {
            // On notifie tous les autres utilisateurs de la salle
            socket.to(user.room).emit("user_typing", {
                username: user.username,
                isTyping: data.isTyping
            });
        }
    });

    // ========================================================================
    // ÉVÉNEMENT: Changement de salle
    // ========================================================================
    /**
     * Permet à un utilisateur de changer de salle de chat
     */
    socket.on("change_room", (data) => {
        try {
            const user = users.get(socket.id);
            if (!user) return;

            const newRoom = sanitizeInput(data.room) || "general";
            const oldRoom = user.room;

            // Si c'est la même salle, on ne fait rien
            if (oldRoom === newRoom) return;

            // On quitte l'ancienne salle
            socket.leave(oldRoom);

            // Message de départ dans l'ancienne salle
            io.to(oldRoom).emit("user_left", {
                type: "system",
                message: `${user.username} a quitté la salle`,
                timestamp: Date.now(),
                room: oldRoom
            });

            // Mise à jour de la liste des utilisateurs dans l'ancienne salle
            io.to(oldRoom).emit("users_list", getUsersInRoom(oldRoom));

            // On rejoint la nouvelle salle
            socket.join(newRoom);
            user.room = newRoom;
            users.set(socket.id, user);

            console.log(`[CHANGEMENT] ${user.username}: ${oldRoom} -> ${newRoom}`);

            // On envoie l'historique de la nouvelle salle
            socket.emit("message_history", getMessageHistory(newRoom));

            // Message d'arrivée dans la nouvelle salle
            io.to(newRoom).emit("user_joined", {
                type: "system",
                message: `${user.username} a rejoint la salle`,
                timestamp: Date.now(),
                room: newRoom
            });

            // Mise à jour de la liste des utilisateurs dans la nouvelle salle
            const usersInRoom = getUsersInRoom(newRoom);
            io.to(newRoom).emit("users_list", usersInRoom);

            // Confirmation du changement
            socket.emit("room_changed", {
                room: newRoom,
                usersCount: usersInRoom.length
            });

        } catch (error) {
            console.error("[ERREUR CHANGEMENT SALLE]", error);
            socket.emit("error", {
                message: "Erreur lors du changement de salle"
            });
        }
    });

    // ========================================================================
    // ÉVÉNEMENT: Déconnexion
    // ========================================================================
    /**
     * Gère la déconnexion d'un utilisateur
     * Nettoie les données et notifie les autres utilisateurs
     */
    socket.on("disconnect", () => {
        const user = users.get(socket.id);

        if (user) {
            console.log(`[DÉCONNEXION] ${user.username} (${socket.id})`);

            // On notifie les autres utilisateurs de la salle
            io.to(user.room).emit("user_left", {
                type: "system",
                message: `${user.username} a quitté le chat`,
                timestamp: Date.now(),
                room: user.room
            });

            // On supprime l'utilisateur de la map
            users.delete(socket.id);

            // On met à jour la liste des utilisateurs dans la salle
            const usersInRoom = getUsersInRoom(user.room);
            io.to(user.room).emit("users_list", usersInRoom);
        } else {
            console.log(`[DÉCONNEXION] Socket non identifié: ${socket.id}`);
        }

        // On nettoie le rate limiting pour ce socket
        rateLimitMap.delete(socket.id);
    });

    // ========================================================================
    // ÉVÉNEMENT: Demande de la liste des utilisateurs
    // ========================================================================
    /**
     * Permet à un client de demander la liste des utilisateurs connectés
     */
    socket.on("get_users", () => {
        const user = users.get(socket.id);
        if (user) {
            const usersInRoom = getUsersInRoom(user.room);
            socket.emit("users_list", usersInRoom);
        }
    });

    // ========================================================================
    // ÉVÉNEMENT: Demande de la liste des salles
    // ========================================================================
    /**
     * Envoie la liste de toutes les salles actives avec le nombre d'utilisateurs
     */
    socket.on("get_rooms", () => {
        const rooms = new Map();

        // On parcourt tous les utilisateurs pour créer la liste des salles
        users.forEach((user) => {
            if (!rooms.has(user.room)) {
                rooms.set(user.room, 0);
            }
            rooms.set(user.room, rooms.get(user.room) + 1);
        });

        // On convertit en tableau d'objets
        const roomsList = Array.from(rooms, ([name, count]) => ({
            name: name,
            usersCount: count
        }));

        socket.emit("rooms_list", roomsList);
    });
});

// ============================================================================
// DÉMARRAGE DU SERVEUR
// ============================================================================

// Le serveur écoute sur le port 3000
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log("============================================");
    console.log(`🚀 Serveur Socket.io démarré sur le port ${PORT}`);
    console.log(`📡 Accéder au chat: http://localhost:${PORT}`);
    console.log("============================================");
});