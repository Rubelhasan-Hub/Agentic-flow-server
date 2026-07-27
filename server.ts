import express from 'express'
import cors from 'cors'
import { MongoClient, ObjectId } from 'mongodb'

const app = express()
const PORT = process.env.PORT || 5000
const MONGODB_URI = process.env.MONGODB_URI || ''

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

const client = new MongoClient(MONGODB_URI)
const itemsCollection = client.db().collection('items')

async function startServer() {
  await client.connect()
  const dbName = client.db().databaseName
  console.log(`Successfully connected to MongoDB database: ${dbName}`)

  app.get('/api/items', async (req, res) => {
    try {
      const items = await itemsCollection.find({}).toArray()
      res.json(items)
    } catch (error) {
      res.status(500).json({ message: 'Error fetching items', error: String(error) })
    }
  })

  app.post('/api/items', async (req, res) => {
    try {
      const item = req.body
      if (!item) {
        return res.status(400).json({ message: 'Request body is required' })
      }
      const result = await itemsCollection.insertOne(item)
      const createdItem = await itemsCollection.findOne({ _id: result.insertedId })
      res.status(201).json(createdItem)
    } catch (error) {
      res.status(500).json({ message: 'Error inserting item', error: String(error) })
    }
  })

  app.delete('/api/items/:id', async (req, res) => {
    try {
      const { id } = req.params
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid item ID' })
      }
      const objectId = new ObjectId(id)
      const result = await itemsCollection.deleteOne({ _id: objectId })
      if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Item not found' })
      }
      res.status(204).send()
    } catch (error) {
      res.status(500).json({ message: 'Error deleting item', error: String(error) })
    }
  })

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
  })
}

startServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
