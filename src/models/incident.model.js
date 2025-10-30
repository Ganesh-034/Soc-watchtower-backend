import mongoose from "mongoose";

const incidentSchema = new mongoose.Schema(
  {
    _id: String,
    subject: String,
    status: Number,
    priority: String,
    description: String,
    created_at: String,
    updated_at: String,
    responder_id: Number,
    soc_analysis: String,
    soc_recommendation: String,
    customer_name: {
      type: String,
      required: true,
      index: true,
    },
    sentinel_incident_number: String,
    ttps: String,
    customer_sub_location: String,
    incident_type: String,
    incident_sub_status: String,
    resolved_by: String,
    customer_escalation: String,
    agent_name: String,
  },
  {
    collection: "freshservice",
    timestamps: false,
  }
);

incidentSchema.index({ customer_name: 1, status: 1 });
incidentSchema.index({ customer_name: 1, created_at: -1 });

const Incident = mongoose.model("Incident", incidentSchema);

export default Incident;
