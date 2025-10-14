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
















// import mongoose from 'mongoose';

// const incidentSchema = new mongoose.Schema(
//   {
//     _id: {
//       type: String,
//       required: true,
//       alias: 'id'
//     },
//     subject: {
//       type: String,
//       required: true,
//       trim: true,
//     },
//     status: {
//       type: Number, // This is a number in your database (2, 3, 5)
//     },
//     priority: {
//       type: String,
//       enum: ['Low', 'Medium', 'High', 'Critical'],
//     },
//     description: {
//       type: String,
//     },
//     created_at: {
//       type: String, // Since dates are stored as strings in your DB
//     },
//     updated_at: {
//       type: String, // Since dates are stored as strings in your DB
//     },
//     soc_analysis: {
//       type: String,
//     },
//     soc_recommendation: {
//       type: String,
//     },
//     customer_name: {
//       type: String,
//     },
//     sentinel_incident_number: {
//       type: String,
//     },
//     ttps: {
//       type: String,
//     },
//     incident_type: {
//       type: String,
//     },
//     incident_sub_status: {
//       type: String,
//     },
//     agent_name: {
//       type: String,
//     }
//   },
//   {
//     timestamps: false, // Don't use mongoose timestamps as we have our own
//     collection: 'freshservice' // Explicitly set collection name
//   }
// );

// // Add text index for better search performance
// incidentSchema.index({
//   subject: 'text',
//   description: 'text',
//   incident_type: 'text',
//   incident_sub_status: 'text',
//   agent_name: 'text',
//   customer_name: 'text'
// });

// const Incident = mongoose.model('Incident', incidentSchema);

// export default Incident;