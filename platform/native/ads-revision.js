// Keep earlier lead-only responses out of VISA's browser and campaign caches.
export const advertisingBasis=slug=>slug==='visa-agency-qa3b'?'meta-results-custom-events-v1':'daily-v2';
export const qualificationBasis=slug=>slug==='visa-agency-qa3b'?'keycrm-utm-toys-v1':'received-v1';
