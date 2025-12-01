import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import {
  uploadPharmacyFiles,
  getAllPharmacyRecords,
  getPharmacyRecordByPan,
  deletePharmacyRecord
} from '../controllers/pharmacyController';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// All routes require authentication
router.use(authenticate);

// Upload pharmacy Excel files
router.post('/upload', upload.array('files', 10), uploadPharmacyFiles);

// Get all pharmacy records with pagination
router.get('/', getAllPharmacyRecords);

// Get single pharmacy record by PAN
router.get('/:pan', getPharmacyRecordByPan);

// Delete pharmacy record by PAN
router.delete('/:pan', deletePharmacyRecord);

export default router;
