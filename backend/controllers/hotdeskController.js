const Hotdesk = require("../models/hotdeskModel");
const asyncHandler = require("express-async-handler");
const queryHelper = require("../utils/queryHelper");
const DeskNumber = require("../models/deskNumberModel");
const Reservation = require("../models/reservationModel");
const ActionType = require("../utils/trails.enum");
const { createAuditTrail } = require("../utils/helpers");
const DeskReport = require("../models/deskReportModel");

const getHotdesks = asyncHandler(async (req, res) => {
  try {
    const desks = await queryHelper(Hotdesk, req.query, "hotdesk");

    res.status(200).json({
      success: true,
      desks,
      totalDocuments: await Hotdesk.countDocuments(),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

const createHotdesk = asyncHandler(async (req, res) => {
  const { deskNumber, essentials } = req.body;

  const actionType = ActionType.DESK_MANAGEMENT;
  const actionDetails = `create hotdesk`;
  let error;

  if (!deskNumber) {
    return res.status(400).json({
      success: false,
      error: "Desk number is required.",
    });
  }

  const existingDesk = await Hotdesk.findOne({ deskNumber });

  if (!(deskNumber >= 1 && deskNumber <= 80)) {
    error = "Invalid desk number";
    createAuditTrail(req, {
      actionType,
      actionDetails,
      status: "failed",
      additionalContext: error,
    });
    return res.status(400).json({ success: false, error });
  }

  if (existingDesk) {
    error = "Desk already exists";
    createAuditTrail(req, {
      actionType,
      actionDetails,
      status: "failed",
      additionalContext: error,
    });
    return res.status(400).json({ success: false, error });
  }

  let area;
  if (deskNumber >= 1 && deskNumber <= 26) {
    area = 1;
  } else if (deskNumber >= 27 && deskNumber <= 53) {
    area = 2;
  } else if (deskNumber >= 54 && deskNumber <= 80) {
    area = 3;
  }

  const hotdesk = await Hotdesk.create({
    area,
    title: `Hotdesk ${deskNumber}`,
    deskNumber,
    workspaceEssentials: essentials,
  });

  if (hotdesk) {
    await DeskNumber.create({
      number: deskNumber,
    });
  }

  createAuditTrail(req, {
    actionType,
    actionDetails,
    status: "success",
    additionalContext: `${hotdesk.title} created`,
  });

  return res.status(201).json({
    success: true,
    hotdesk,
  });
});

const deleteHotdesk = asyncHandler(async (req, res) => {
  const hotdesk = await Hotdesk.findById(req.params.id);

  const actionType = ActionType.DESK_MANAGEMENT;
  const actionDetails = `delete hotdesk`;

  if (!hotdesk) {
    res.status(400).json({
      success: false,
      error: "Hotdesk not found",
    });
  }

  await DeskNumber.findOneAndDelete({ number: hotdesk.deskNumber });
  const deletedDesk = await Hotdesk.findByIdAndDelete(req.params.id);

  createAuditTrail(req, {
    actionType,
    actionDetails,
    status: "success",
    additionalContext: `${deletedDesk.title} deleted`,
  });

  return res.status(200).json({ success: true, desk: deletedDesk });
});

const updateHotdesk = asyncHandler(async (req, res) => {
  const hotdesk = await Hotdesk.findById(req.params.id);
  const { essentials, status } = req.body;
  const currentDate = new Date();

  const actionType = ActionType.DESK_MANAGEMENT;
  const actionDetails = `update hotdesk`;
  let error;

  const reservedDesks = [];
  currentDate.setUTCHours(0, 0, 0, 0);

  const reservations = await Reservation.find({
    date: currentDate.toISOString(),
  });

  for (const reservation of reservations) {
    reservedDesks.push(reservation.deskNumber);
  }

  if (reservedDesks.includes(hotdesk.deskNumber)) {
    createAuditTrail(req, {
      actionType,
      actionDetails,
      status: "failed",
      additionalContext: "The hotdesk cannot be updated as of the moment",
    });
    return res.status(400).json({
      success: false,
      error:
        "The hotdesk cannot be updated. Please choose an available hotdesk or try again later.",
    });
  } else {
    hotdesk.workspaceEssentials =
      essentials == null ? hotdesk.workspaceEssentials : essentials;
    hotdesk.status = status ?? hotdesk.status;
    await hotdesk.save();
    createAuditTrail(req, {
      actionType,
      actionDetails,
      status: "success",
      additionalContext: `${hotdesk.title} updated`,
    });
    return res.status(200).json({ succcess: true, hotdesk });
  }
});

const submitReport = asyncHandler(async (req, res) => {
  const { date, selectedDesk, report } = req.body;

  const actionType = ActionType.REPORT;
  const actionDetails = `submit report`;
  let error;

  if (!selectedDesk || !report) {
    error = "Hotdesk and explanation are required";
    createAuditTrail(req, {
      actionType,
      actionDetails,
      status: "failed",
      additionalContext: error,
    });
    return res.status(400).json({
      success: false,
      error,
    });
  }

  const desk = await Hotdesk.findOne({ deskNumber: selectedDesk.deskNumber });

  try {
    await DeskReport.create({
      user: req.user.id,
      desk: desk._id,
      deskNumber: selectedDesk.deskNumber,
      date: new Date(date) || null,
      report,
    });
    createAuditTrail(req, {
      actionType,
      actionDetails,
      status: "success",
      additionalContext: `${req.user.username} filed an issue for ${selectedDesk.title}`,
    });

    return res.status(200).json({
      success: true,
      message: "Report submitted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

const getReports = asyncHandler(async (req, res) => {
  try {
    const reports = await queryHelper(DeskReport, req.query, "report");

    return res.status(200).json({
      success: true,
      reports,
      totalDocuments: await DeskReport.countDocuments(),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

const handleReport = asyncHandler(async (req, res) => {
  const report = await DeskReport.findById(req.params.id).populate("user");
  const { action } = req.params;

  const actionType = ActionType.REPORT;
  const actionDetails = `handle report`;
  let error;

  if (!report) {
    error = "Report not found";
    createAuditTrail(req, {
      actionType,
      actionDetails,
      status: "failed",
      additionalContext: error,
    });
    return res.status(400).json({
      success: false,
      error,
    });
  }

  try {
    if (action === "resolve") {

      if (report.status !== 'UNRESOLVED'){
        error = "The report is already resolved";
        createAuditTrail(req, {
          actionType,
          actionDetails,
          status: "failed",
          additionalContext: error,
        });
        return res.status(400).json({
          success: false,
          error,
        });
      }

      report.status = "RESOLVED";
      await report.save();

      createAuditTrail(req, {
        actionType,
        actionDetails,
        status: "success",
        additionalContext: `${req.user.username} marked the issue filed by ${report.user.username} as resolved`,
      });

      return res.status(200).json({
        success: true,
        report,
        message: "Report marked as resolved",
      });
    }
    return res
    .status(400)
    .json({ success: false, error: "Invalid action" });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

module.exports = {
  getHotdesks,
  createHotdesk,
  deleteHotdesk,
  updateHotdesk,
  submitReport,
  getReports,
  handleReport
};
