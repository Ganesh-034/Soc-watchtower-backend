import mongoose from 'mongoose';

const incidentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    severity: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      required: true,
    },
    detectionSource: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['Open', 'Closed', 'In Progress'],
      default: 'Open',
    },
    subStatus: {
      type: String,
    },
    description: {
      type: String,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

const Incident = mongoose.model('Incident', incidentSchema, 'freshservice');

export default Incident;