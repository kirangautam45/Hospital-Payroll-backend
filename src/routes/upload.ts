import { Router } from 'express'
import multer from 'multer'
import { uploadFiles } from '../controllers/uploadController'
import { authenticate } from '../middleware/auth'

const router = Router()

const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ]
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only Excel and CSV files are allowed.'))
    }
  },
})

router.post('/', authenticate, upload.array('files', 10), uploadFiles)

export default router
