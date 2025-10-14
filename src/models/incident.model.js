// import mongoose from 'mongoose';

// const incidentSchema = new mongoose.Schema(
//   {
//     title: {
//       type: String,
//       required: true,
//       trim: true,
//     },
//     severity: {
//       type: String,
//       enum: ['Low', 'Medium', 'High', 'Critical'],
//       required: true,
//     },
//     detectionSource: {
//       type: String,
//       required: true,
//     },
//     status: {
//       type: String,
//       enum: ['Open', 'Closed', 'In Progress'],
//       default: 'Open',
//     },
//     subStatus: {
//       type: String,
//     },
//     description: {
//       type: String,
//       required: true,
//     },
//     createdBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//     },
//   },
//   {
//     timestamps: true,
//   }
// );

// const Incident = mongoose.model('Incident', incidentSchema, 'freshservice');

// export default Incident;














import mongoose from 'mongoose';

const incidentSchema = new mongoose.Schema(
  {
    _id: String,
    subject: String,
    status: Number, // Changed to Number to match actual data
    priority: String,
    description: String,
    created_at: String,
    updated_at: String,
    responder_id: Number,
    soc_analysis: String,
    soc_recommendation: String,
    customer_name: String,
    sentinel_incident_number: String,
    ttps: String,
    customer_sub_location: String,
    incident_type: String,
    incident_sub_status: String,
    resolved_by: String,
    customer_escalation: String,
    agent_name: String
  },
  {
    collection: 'freshservice', // Explicitly set the collection name
    timestamps: false // Disable default timestamps since you have created_at and updated_at
  }
);

const Incident = mongoose.model('Incident', incidentSchema);

export default Incident;