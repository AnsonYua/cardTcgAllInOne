function normalizeActivationWindows(rule) {
    if (!Array.isArray(rule?.timing?.activationWindows)) {
        return [];
    }
    return rule.timing.activationWindows.map((window) => String(window).toUpperCase());
}

function getEventTrigger(rule) {
    const eventTrigger = rule?.timing?.eventTrigger;
    return typeof eventTrigger === 'string' ? eventTrigger.toUpperCase() : '';
}

function getDuration(rule) {
    const duration = rule?.timing?.duration;
    return typeof duration === 'string' ? duration : '';
}

module.exports = {
    normalizeActivationWindows,
    getEventTrigger,
    getDuration
};
