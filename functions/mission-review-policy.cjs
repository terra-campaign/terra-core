'use strict';
const WINDOW_MS = 3 * 60 * 60 * 1000;
const NEXT = {admin:'coordinador_municipal',coordinador_municipal:'jefe_estructura',jefe_estructura:'integrante',integrante:'participante'};
function parentOf(parent, child) {
  return !!parent && !!child && parent.active === true && child.active === true &&
    !!parent.campaignId && parent.campaignId === child.campaignId && NEXT[parent.role] === child.role &&
    child.parentUserId === parent.uid && (parent.role === 'admin' ||
      (!!parent.municipalityId && parent.municipalityId === child.municipalityId)) &&
    (!['jefe_estructura','integrante'].includes(parent.role) ||
      (!!parent.structureId && parent.structureId === child.structureId));
}
function actions(review, direct, superior, now) {
  const canDecide = direct && (!review || (review.escalated !== true && now < review.reconsiderUntil));
  return {canDecide:!!canDecide,
    canRequest:!!(direct && review && now >= review.reconsiderUntil && !review.pendingAppeal),
    canResolve:!!(superior && review?.pendingAppeal)};
}
module.exports = {WINDOW_MS,parentOf,actions};
