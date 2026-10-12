"use strict";

const { onCall, HttpsError } =
  require("firebase-functions/v2/https");

const { getFirestore } =
  require("firebase-admin/firestore");

const {
  discoverSmartAssignmentPublicAuthenticated
} = require("./mission-smart-assignment-authenticated.cjs");

const OPTIONS = {
  region: "us-central1",
  timeoutSeconds: 60
};

exports.getSmartAssignmentCandidates = onCall(
  OPTIONS,
  async request => {

    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Inicia sesion."
      );
    }

    const data = request.data;

    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      typeof data.activityCode !== "string" ||
      !data.activityCode.trim() ||
      data.activityCode.length > 100
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Selecciona un tipo de actividad valido."
      );
    }

    try {
      return await discoverSmartAssignmentPublicAuthenticated({
        db: getFirestore(),
        request,
        activityCode: data.activityCode
      });

    } catch (error) {

      if (
        error?.message ===
        "smart-assignment-unauthenticated"
      ) {
        throw new HttpsError(
          "unauthenticated",
          "Inicia sesion."
        );
      }

      if (
        error?.message ===
          "smart-assignment-permission-denied" ||
        error?.message ===
          "smart-assignment-profile-not-found"
      ) {
        throw new HttpsError(
          "permission-denied",
          "No tienes autorizacion para esta consulta."
        );
      }

      console.error(
        "B8 smart assignment read failed:",
        error?.message
      );

      throw new HttpsError(
        "failed-precondition",
        "No se pudo completar la consulta de candidatos."
      );
    }
  }
);