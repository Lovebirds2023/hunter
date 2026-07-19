const slotStartTime = (slot) => {
    const date = new Date(slot?.start_time);
    return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
};

const slotEndTime = (slot) => {
    const end = new Date(slot?.end_time || slot?.start_time);
    return Number.isNaN(end.getTime()) ? null : end.getTime();
};

export const getUpcomingEventSlots = (slots = [], referenceTime = Date.now()) => (
    Array.isArray(slots)
        ? slots
            .filter(slot => {
                const endTime = slotEndTime(slot);
                return endTime !== null && endTime > referenceTime;
            })
            .sort((a, b) => slotStartTime(a) - slotStartTime(b))
        : []
);

export const getEventDisplayDate = (event, referenceTime = Date.now()) => {
    const nextSlot = getUpcomingEventSlots(event?.available_slots, referenceTime)[0];
    const date = new Date(nextSlot?.start_time || event?.start_time);
    return Number.isNaN(date.getTime()) ? new Date() : date;
};

export const eventHasFutureAvailability = (event, referenceTime = Date.now()) => {
    const slots = Array.isArray(event?.available_slots) ? event.available_slots : [];
    if (slots.length > 0 || event?.has_booking_schedule) {
        return getUpcomingEventSlots(slots, referenceTime).length > 0;
    }

    const end = new Date(event?.end_time || event?.start_time);
    return !Number.isNaN(end.getTime()) && end.getTime() > referenceTime;
};

export const getUpcomingSlotCount = (event, referenceTime = Date.now()) => (
    getUpcomingEventSlots(event?.available_slots, referenceTime).length
);
