import express from 'express'
import cors from 'cors'
import { MongoClient, ObjectId } from 'mongodb'

const app = express()
const PORT = process.env.PORT || 5000
const MONGODB_URI = process.env.MONGODB_URI || ''
const DB_NAME = 'agenticflow_db'
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000'

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }))
app.use(express.json())

let clientPromise: Promise<MongoClient>

if (process.env.NODE_ENV === 'production') {
  clientPromise = MongoClient.connect(MONGODB_URI, { maxPoolSize: 1 })
} else {
    if (!(global as unknown as { _mongoClientPromise?: Promise<MongoClient> })._mongoClientPromise) {
      ;(global as unknown as { _mongoClientPromise: Promise<MongoClient> })._mongoClientPromise = MongoClient.connect(
        MONGODB_URI,
        { maxPoolSize: 10 }
      )
    }
    clientPromise = (global as unknown as { _mongoClientPromise: Promise<MongoClient> })._mongoClientPromise
}

app.get('/', (req, res) => {
  res.json({ message: 'Server is running successfully' })
})

app.get('/api/health', async (req, res) => {
  try {
    const client = await clientPromise
    await client.db(DB_NAME).admin().ping()
    res.json({ status: 'healthy', database: DB_NAME, timestamp: new Date().toISOString() })
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: String(error), timestamp: new Date().toISOString() })
  }
})

app.get('/api/items', async (req, res) => {
  try {
    const client = await clientPromise
    const collection = client.db(DB_NAME).collection('items')

    const search = (req.query.search as string) || ''
    const category = (req.query.category as string) || ''
    const sortBy = (req.query.sortBy as string) || 'createdAt'
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc'
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10))

    const filter: Record<string, unknown> = {}

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ]
    }

    if (category) {
      filter.category = category
    }

    const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder === 'asc' ? 1 : -1 }

    const totalItems = await collection.countDocuments(filter)
    const totalPages = Math.ceil(totalItems / limit) || 1
    const skip = (page - 1) * limit

    const items = await collection.find(filter).sort(sort).skip(skip).limit(limit).toArray()

    res.json({ items, totalItems, totalPages, currentPage: page })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching items', error: String(error) })
  }
})

app.post('/api/items', async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ message: 'Request body is required' })
    }

    const client = await clientPromise
    const collection = client.db(DB_NAME).collection('items')

    const item = { ...req.body, createdAt: new Date() }
    const result = await collection.insertOne(item)
    const createdItem = await collection.findOne({ _id: result.insertedId })

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

    const client = await clientPromise
    const collection = client.db(DB_NAME).collection('items')

    const result = await collection.deleteOne({ _id: new ObjectId(id) })

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Item not found' })
    }

    res.status(204).send()
  } catch (error) {
    res.status(500).json({ message: 'Error deleting item', error: String(error) })
  }
})

app.post('/api/users', async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ message: 'Request body is required' })
    }

    const client = await clientPromise
    const collection = client.db(DB_NAME).collection('users')

    const result = await collection.insertOne(req.body)
    const createdUser = await collection.findOne({ _id: result.insertedId })

    res.status(201).json(createdUser)
  } catch (error) {
    res.status(500).json({ message: 'Error saving user', error: String(error) })
  }
})

export default app

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
  })
}
