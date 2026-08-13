const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');

const router = express.Router();
const pool = new pg.Pool({
  host: 'localhost',
  port: 5432,
  database: 'scanstock',
  user: 'postgres',
  password: '0000'
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Register
router.post('/auth/register', async (req, res) => {
  const { nom, motDePasse, role } = req.body;
  const hash = await bcrypt.hash(motDePasse, 10);
  const user = await prisma.user.create({
    data: { nom, motDePasseHash: hash, role: role || 'caissier' }
  });
  res.json({ message: 'Utilisateur créé', userId: user.id });
});

// Login
router.post('/auth/login', async (req, res) => {
  const { nom, motDePasse } = req.body;
  const user = await prisma.user.findFirst({ where: { nom } });
  if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
  const valid = await bcrypt.compare(motDePasse, user.motDePasseHash);
  if (!valid) return res.status(401).json({ message: 'Mot de passe incorrect' });
  const token = jwt.sign({ userId: user.id, role: user.role }, 'scanstock_secret', { expiresIn: '24h' });
  res.json({ token, role: user.role });
});

// Produits - Créer
router.post('/produits', async (req, res) => {
  const { nom, codeBarre, stockActuel, stockSecurite } = req.body;
  const produit = await prisma.product.create({
    data: { nom, codeBarre, stockActuel: stockActuel || 0, stockSecurite: stockSecurite || 5 }
  });
  res.json(produit);
});

// Produits - Lister
router.get('/produits', async (req, res) => {
  const produits = await prisma.product.findMany();
  res.json(produits);
});

// Produits - Un seul
router.get('/produits/:id', async (req, res) => {
  const produit = await prisma.product.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!produit) return res.status(404).json({ message: 'Produit non trouvé' });
  res.json(produit);
});

// Produits - Modifier
router.put('/produits/:id', async (req, res) => {
  const { nom, stockActuel, stockSecurite } = req.body;
  const produit = await prisma.product.update({
    where: { id: parseInt(req.params.id) },
    data: { nom, stockActuel, stockSecurite }
  });
  res.json(produit);
});

// Produits - Supprimer
router.delete('/produits/:id', async (req, res) => {
  await prisma.product.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ message: 'Produit supprimé' });
});

// Mouvements - Entrée/Sortie
router.post('/mouvements', async (req, res) => {
  const { productId, type, quantite, userId } = req.body;
  const mouvement = await prisma.movement.create({
    data: { productId, type, quantite, userId }
  });
  const produit = await prisma.product.findUnique({ where: { id: productId } });
  const newStock = type === 'entree'
    ? produit.stockActuel + quantite
    : produit.stockActuel - quantite;
  await prisma.product.update({
    where: { id: productId },
    data: { stockActuel: newStock }
  });
  res.json({ mouvement, newStock });
});

// Mouvements - Historique
router.get('/mouvements', async (req, res) => {
  const mouvements = await prisma.movement.findMany({
    include: { product: true, user: true }
  });
  res.json(mouvements);
});

module.exports = router;