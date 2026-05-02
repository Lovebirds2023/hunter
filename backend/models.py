from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum, JSON, Boolean
from sqlalchemy.orm import relationship
from database import Base
import datetime
import enum

class UserRole(str, enum.Enum):
    BUYER = "buyer"
    PROVIDER = "provider"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"

class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    COMPLETED = "completed"
    SETTLED = "settled"
    CANCELLED = "cancelled"

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String)
    role = Column(String, default="buyer")
    phone_number = Column(String, nullable=True)
    country = Column(String, nullable=True)
    language = Column(String, default="en")
    profile_image = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    address = Column(String, nullable=True)
    expo_push_token = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    timezone = Column(String, nullable=True)
    preferred_currency = Column(String, nullable=True)
    mpesa_phone_number = Column(String, nullable=True)
    average_rating = Column(Float, default=0.0)
    total_ratings = Column(Integer, default=0)
    
    # Community Hub Fields (Disabled until columns are added to Supabase)
    is_online = Column(Boolean, default=False)
    last_seen = Column(DateTime, default=datetime.datetime.utcnow)
    karma_points = Column(Integer, default=0) # Total karma ever earned
    available_karma = Column(Integer, default=0) # Karma currently available for redemption
    
    dogs = relationship("Dog", back_populates="owner")

    services = relationship("Service", back_populates="provider")
    orders = relationship("Order", foreign_keys="Order.buyer_id", back_populates="buyer")
    payouts = relationship("Transaction", back_populates="user")
    ratings_received = relationship("Rating", foreign_keys="Rating.rated_id", back_populates="rated_user")
    ratings_given = relationship("Rating", foreign_keys="Rating.rater_id", back_populates="rater_user")
    events = relationship("Event", back_populates="organizer")
    registrations = relationship("Registration", back_populates="user")
    case_reports = relationship("CaseReport", back_populates="author")
    case_comments = relationship("CaseComment", back_populates="author")
    case_likes = relationship("CaseLike", back_populates="user")

class Spotlight(Base):
    __tablename__ = "spotlight"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    target_route = Column(String, nullable=True) # e.g. 'CaseDetail'
    target_id = Column(String, nullable=True)    # ID of the item
    is_active = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class Dog(Base):
    __tablename__ = "dogs"

    id = Column(String, primary_key=True, index=True)
    owner_id = Column(String, ForeignKey("users.id"))
    name = Column(String)
    breed = Column(String)
    color = Column(String)
    height = Column(Float)
    weight = Column(Float)
    age = Column(Float, nullable=True)
    pet_type = Column(String, default="dog")  # "dog" or "cat"
    body_structure = Column(String)
    bio = Column(String, nullable=True)
    nose_print_descriptor = Column(JSON) # Storing ORB descriptors
    nose_print_image = Column(String, nullable=True) # URL/Path to nose print image
    body_image = Column(String, nullable=True) # URL/Path to full body image
    birthmark_image = Column(String, nullable=True) # URL/Path to birthmark image
    vaccination_card_image = Column(String, nullable=True) # URL/Path to vaccination card
    
    owner = relationship("User", back_populates="dogs")
    health_records = relationship("HealthRecord", back_populates="dog")

class ItemType(str, enum.Enum):
    PRODUCT = "products"
    SERVICE = "services"

class ServiceCategory(str, enum.Enum):
    # Services
    HEALTH = "health"
    THERAPY_WELLBEING = "therapy & wellbeing"
    TRAINING = "training"
    GROOMING = "grooming"
    BOARDING_CARE = "boarding / care"
    EVENTS_PROGRAMS = "events & programs"
    SAFETY_COMPLIANCE = "safety & compliance"
    REHOMING = "rehoming"
    # Products
    FOOD = "food"
    HEALTH_PRODUCTS = "health products"
    EQUIPMENT = "equipment"
    TOYS = "toys"
    TRAVEL = "travel"
    THERAPY_GEAR = "therapy gear"

class Service(Base):
    __tablename__ = "services"

    id = Column(String, primary_key=True, index=True)
    provider_id = Column(String, ForeignKey("users.id"))
    title = Column(String)
    description = Column(String)
    price = Column(Float)
    
    # Updated fields
    item_type = Column(String, default=ItemType.SERVICE) # "product" or "service"
    category = Column(String) # Storing string value of ServiceCategory
    image_url = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    address = Column(String, nullable=True)
    location_landmark = Column(String, nullable=True)
    is_published = Column(Boolean, default=True)
    currency = Column(String, default="KES")
    stock_count = Column(Integer, default=0)
    slots_available = Column(Integer, default=0)
    is_busy = Column(Boolean, default=False)
    images = Column(JSON, nullable=True)
    admin_approved = Column(Boolean, default=False)
    rejection_reason = Column(String, nullable=True)
    
    provider = relationship("User", back_populates="services")
    orders = relationship("Order", back_populates="service")
    form_fields = relationship("ServiceFormField", back_populates="service", cascade="all, delete-orphan")

class ServiceFormField(Base):
    __tablename__ = "service_form_fields"

    id = Column(String, primary_key=True, index=True)
    service_id = Column(String, ForeignKey("services.id"))
    field_type = Column(String) # short_answer, long_answer, dropdown, multiple_choice, scale
    label = Column(String)
    options = Column(JSON, nullable=True)
    is_required = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    service = relationship("Service", back_populates="form_fields")
    responses = relationship("OrderFormResponse", back_populates="field")

class OrderFormResponse(Base):
    __tablename__ = "order_form_responses"

    id = Column(String, primary_key=True, index=True)
    order_id = Column(String, ForeignKey("orders.id"))
    field_id = Column(String, ForeignKey("service_form_fields.id"))
    answer_value = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    order = relationship("Order", back_populates="responses")
    field = relationship("ServiceFormField", back_populates="responses")

class Order(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True, index=True)
    buyer_id = Column(String, ForeignKey("users.id"))
    service_id = Column(String, ForeignKey("services.id"))
    amount = Column(Float)
    commission = Column(Float)
    payout = Column(Float)
    status = Column(String, default="PENDING")
    share_phone = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    buyer = relationship("User", foreign_keys=[buyer_id], back_populates="orders")
    service = relationship("Service", back_populates="orders")
    transactions = relationship("Transaction", back_populates="order")
    responses = relationship("OrderFormResponse", back_populates="order", cascade="all, delete-orphan")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, index=True)
    order_id = Column(String, ForeignKey("orders.id"))
    user_id = Column(String, ForeignKey("users.id")) # Provider who receives payout
    amount = Column(Float)
    type = Column(String) # "escrow", "payout", "refund"
    status = Column(String) # "pending", "completed", "failed"
    processed_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    order = relationship("Order", back_populates="transactions")
    user = relationship("User", back_populates="payouts")

class Event(Base):
    __tablename__ = "events"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String)
    location = Column(String)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    capacity = Column(Integer, default=0) # 0 means unlimited
    organizer_id = Column(String, ForeignKey("users.id"))
    category = Column(String) # e.g., "walk", "training", "outreach"
    is_public = Column(Integer, default=1) # 1 for public, 0 for private
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    organizer = relationship("User", back_populates="events")
    registrations = relationship("Registration", back_populates="event")

class Registration(Base):
    __tablename__ = "registrations"

    id = Column(String, primary_key=True, index=True)
    event_id = Column(String, ForeignKey("events.id"))
    user_id = Column(String, ForeignKey("users.id"))
    dog_id = Column(String, ForeignKey("dogs.id"), nullable=True)
    status = Column(String, default="registered") # registered, waitlisted, cancelled, checked-in
    role = Column(String, default="attendee") # attendee, volunteer, staff
    check_in_time = Column(DateTime, nullable=True)
    ticket_token = Column(String, unique=True, index=True, nullable=True) # For QR code validation
    share_phone = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    event = relationship("Event", back_populates="registrations")
    user = relationship("User", back_populates="registrations")
    dog = relationship("Dog")
    responses = relationship("RegistrationResponse", back_populates="registration")


class SavedEvent(Base):
    __tablename__ = "saved_events"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    event_id = Column(String, ForeignKey("events.id", ondelete="CASCADE"))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User")
    event = relationship("Event")


class EventFormField(Base):
    __tablename__ = "event_form_fields"

    id = Column(String, primary_key=True, index=True)
    event_id = Column(String, ForeignKey("events.id", ondelete="CASCADE"))
    field_type = Column(String, nullable=False)  # short_answer, long_answer, dropdown, multiple_choice, scale
    label = Column(String, nullable=False)
    options = Column(JSON, nullable=True)  # For dropdown/multiple_choice
    is_required = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    event = relationship("Event")


class RegistrationResponse(Base):
    __tablename__ = "registration_responses"

    id = Column(String, primary_key=True, index=True)
    registration_id = Column(String, ForeignKey("registrations.id", ondelete="CASCADE"))
    field_id = Column(String, ForeignKey("event_form_fields.id", ondelete="CASCADE"))
    answer_value = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    registration = relationship("Registration", back_populates="responses")
    field = relationship("EventFormField")

class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    subject = Column(String, nullable=False)
    message = Column(String, nullable=False)
    status = Column(String, default="open") # open, in_progress, resolved
    admin_reply = Column(String, nullable=True)
    images = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User")

class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    target_audience = Column(String, default="all") # all, providers, buyers
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    type = Column(String, default="info") # info, approval, rejection, feedback
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    target_type = Column(String) # e.g., "event", "registration"
    target_id = Column(String)
    details = Column(String)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class Rating(Base):
    __tablename__ = "ratings"

    id = Column(String, primary_key=True, index=True)
    order_id = Column(String, ForeignKey("orders.id"), unique=True) # One rating per order
    rater_id = Column(String, ForeignKey("users.id"))
    rated_id = Column(String, ForeignKey("users.id"))
    score = Column(Integer) # 1-5
    comment = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    rater_user = relationship("User", foreign_keys=[rater_id], back_populates="ratings_given")
    rated_user = relationship("User", foreign_keys=[rated_id], back_populates="ratings_received")

class HealthRecordType(str, enum.Enum):
    VACCINATION = "vaccination"
    DEWORMING = "deworming"
    GROOMING = "grooming"
    CHECKUP = "checkup"

class HealthRecord(Base):
    __tablename__ = "health_records"

    id = Column(String, primary_key=True, index=True)
    dog_id = Column(String, ForeignKey("dogs.id"))
    record_type = Column(String) # Enum HealthRecordType
    date = Column(DateTime, nullable=False)
    next_due_date = Column(DateTime, nullable=True)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    dog = relationship("Dog", back_populates="health_records")

# Update User model to include relationships
User.events = relationship("Event", back_populates="organizer")
User.registrations = relationship("Registration", back_populates="user")


# =====================================================
# Dog Case Reporting — Social Feature
# =====================================================

class CaseType(str, enum.Enum):
    RABIES_BITE = "rabies_bite"
    VEHICLE_HIT = "vehicle_hit"
    INJURED_STRAY = "injured_stray"
    LOST_DOG = "lost_dog"
    FOUND_DOG = "found_dog"
    ABUSE = "abuse"
    OTHER = "other"

class CaseStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"

class CaseReport(Base):
    __tablename__ = "case_reports"

    id = Column(String, primary_key=True, index=True)
    author_id = Column(String, ForeignKey("users.id"))
    case_type = Column(String, nullable=False)  # CaseType enum value
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    breed = Column(String, nullable=True)
    color = Column(String, nullable=True)
    location = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    images = Column(JSON, nullable=True)  # List of additional photo URLs
    status = Column(String, default=CaseStatus.OPEN)
    is_approved = Column(Boolean, default=False)
    rejection_reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    author = relationship("User", back_populates="case_reports")
    comments = relationship("CaseComment", back_populates="report", order_by="CaseComment.created_at")
    likes = relationship("CaseLike", back_populates="report")

class CaseComment(Base):
    __tablename__ = "case_comments"

    id = Column(String, primary_key=True, index=True)
    report_id = Column(String, ForeignKey("case_reports.id"))
    author_id = Column(String, ForeignKey("users.id"))
    content = Column(String, nullable=False)
    tagged_users = Column(JSON, nullable=True)  # list of user IDs mentioned via @
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    report = relationship("CaseReport", back_populates="comments")
    author = relationship("User", back_populates="case_comments")

class CaseLike(Base):
    __tablename__ = "case_likes"

    id = Column(String, primary_key=True, index=True)
    report_id = Column(String, ForeignKey("case_reports.id"))
    user_id = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    report = relationship("CaseReport", back_populates="likes")
    user = relationship("User", back_populates="case_likes")

# Add case reporting relationships to User
User.case_reports = relationship("CaseReport", back_populates="author")
User.case_comments = relationship("CaseComment", back_populates="author")
User.case_likes = relationship("CaseLike", back_populates="user")


# =====================================================
# Lovedogs 360 Event Specific Models
# =====================================================

class ProgramJourney(Base):
    __tablename__ = "program_journeys"

    id = Column(String, primary_key=True, index=True)
    event_id = Column(String, ForeignKey("events.id"))
    user_id = Column(String, ForeignKey("users.id"))
    dog_id = Column(String, ForeignKey("dogs.id"), nullable=True)
    progress_percentage = Column(Float, default=0.0)
    current_timepoint = Column(String, default="T1") # T1, T2, T3, T4
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    event = relationship("Event", backref="program_journeys")
    user = relationship("User", backref="program_journeys")
    dog = relationship("Dog")

class CheckInData(Base):
    __tablename__ = "checkin_data"

    id = Column(String, primary_key=True, index=True)
    event_id = Column(String, ForeignKey("events.id"))
    user_id = Column(String, ForeignKey("users.id"))
    dog_id = Column(String, ForeignKey("dogs.id"), nullable=True)
    timepoint = Column(String) # T1, T2, T3, T4
    who5_answers = Column(JSON, nullable=True)
    pss10_answers = Column(JSON, nullable=True)
    relationship_answers = Column(JSON, nullable=True)
    welfare_snapshot = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class LiveObservation(Base):
    __tablename__ = "live_observations"

    id = Column(String, primary_key=True, index=True)
    event_id = Column(String, ForeignKey("events.id"))
    observer_id = Column(String, ForeignKey("users.id")) # Vet or Facilitator
    participant_id = Column(String, ForeignKey("users.id"))
    dog_id = Column(String, ForeignKey("dogs.id"), nullable=True)
    behavior = Column(String) # panting, freezing, avoidance, yawning, engagement, calmness, adverse_event
    intensity = Column(String, nullable=True) # low, medium, high
    notes = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    is_offline_sync = Column(Boolean, default=False)
    synced_at = Column(DateTime, default=datetime.datetime.utcnow)

# =====================================================
# Community Hub & Social Models
# =====================================================

class CommunityMessage(Base):
    __tablename__ = "community_messages"

    id = Column(String, primary_key=True, index=True)
    author_id = Column(String, ForeignKey("users.id"))
    content = Column(String, nullable=False)
    latitude = Column(Float, nullable=True) # Attached for proximity filtering
    longitude = Column(Float, nullable=True)
    is_global = Column(Boolean, default=True)
    reshare_id = Column(String, ForeignKey("community_messages.id"), nullable=True)
    
    # New Fields for Advanced Social Features
    hashtags = Column(JSON, default=list)
    is_poll = Column(Boolean, default=False)
    poll_options = Column(JSON, nullable=True) # e.g. [{"id": 1, "text": "Option A"}]
    flag_count = Column(Integer, default=0)
    is_hidden = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    author = relationship("User")
    reactions = relationship("ChatReaction", back_populates="message")
    reshares = relationship("CommunityMessage", remote_side=[id])
    poll_votes = relationship("CommunityPollVote", back_populates="message")

class CommunityPollVote(Base):
    __tablename__ = "community_poll_votes"

    id = Column(String, primary_key=True, index=True)
    message_id = Column(String, ForeignKey("community_messages.id"))
    user_id = Column(String, ForeignKey("users.id"))
    option_id = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    message = relationship("CommunityMessage", back_populates="poll_votes")
    user = relationship("User")

class DirectMessage(Base):
    __tablename__ = "direct_messages"

    id = Column(String, primary_key=True, index=True)
    sender_id = Column(String, ForeignKey("users.id"))
    receiver_id = Column(String, ForeignKey("users.id"))
    content = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    read_at = Column(DateTime, nullable=True)

    sender = relationship("User", foreign_keys=[sender_id])
    receiver = relationship("User", foreign_keys=[receiver_id])

class ChatReaction(Base):
    __tablename__ = "chat_reactions"

    id = Column(String, primary_key=True, index=True)
    message_id = Column(String, ForeignKey("community_messages.id"))
    user_id = Column(String, ForeignKey("users.id"))
    reaction_type = Column(String) # like, love, etc.
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    message = relationship("CommunityMessage", back_populates="reactions")
    user = relationship("User")

class KarmaTransaction(Base):
    __tablename__ = "karma_transactions"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    amount = Column(Integer) # positive for earning, negative for spending
    category = Column(String) # case_report, comment, redemption, chat
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User")


