from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
import datetime
from models import UserRole, OrderStatus

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    country: Optional[str] = None
    language: Optional[str] = "en"

class UserCreate(UserBase):
    password: str
    phone_number: Optional[str] = None
    bio: Optional[str] = None

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    bio: Optional[str] = None
    profile_image: Optional[str] = None
    country: Optional[str] = None
    language: Optional[str] = None
    mpesa_phone_number: Optional[str] = None
    preferred_currency: Optional[str] = None
    is_online: Optional[bool] = None
    last_seen: Optional[datetime.datetime] = None
    karma_points: Optional[int] = None

class UserResponse(UserBase):
    id: str
    phone_number: Optional[str] = None
    country: Optional[str] = None
    language: Optional[str] = "en"
    profile_image: Optional[str] = None
    bio: Optional[str] = None
    mpesa_phone_number: Optional[str] = None
    preferred_currency: Optional[str] = None
    average_rating: float = 0.0
    total_ratings: int = 0
    is_online: bool = False
    last_seen: Optional[datetime.datetime] = None
    karma_points: int = 0
    available_karma: int = 0

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class DogBase(BaseModel):
    name: str
    breed: str
    color: str
    height: float
    weight: float
    age: Optional[float] = None
    pet_type: Optional[str] = "dog"
    body_structure: str
    nose_print_image: Optional[str] = None
    body_image: Optional[str] = None
    birthmark_image: Optional[str] = None
    vaccination_card_image: Optional[str] = None
    bio: Optional[str] = None

class DogCreate(DogBase):
    pass

class DogUpdate(BaseModel):
    name: Optional[str] = None
    breed: Optional[str] = None
    color: Optional[str] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    age: Optional[float] = None
    pet_type: Optional[str] = None
    body_structure: Optional[str] = None
    bio: Optional[str] = None
    body_image: Optional[str] = None

class DogResponse(DogBase):
    id: str
    owner_id: str
    class Config:
        from_attributes = True

class ServiceFormFieldCreate(BaseModel):
    field_type: str  # short_answer, long_answer, dropdown, multiple_choice, scale
    label: str
    options: Optional[List[Dict[str, Any]]] = None
    is_required: Optional[bool] = False
    sort_order: Optional[int] = 0

class ServiceBase(BaseModel):
    title: str
    description: str
    price: float
    category: str
    item_type: Optional[str] = "services"
    image_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    location_landmark: Optional[str] = None
    is_published: Optional[bool] = True
    currency: Optional[str] = "KES"
    stock_count: Optional[int] = 0
    slots_available: Optional[int] = 0
    is_busy: Optional[bool] = False
    images: Optional[List[str]] = None
    admin_approved: Optional[bool] = False
    rejection_reason: Optional[str] = None

class ServiceCreate(ServiceBase):
    form_fields: Optional[List[ServiceFormFieldCreate]] = None

class ProviderMini(BaseModel):
    full_name: str
    profile_image: Optional[str] = None
    average_rating: float = 0.0
    total_ratings: int = 0
    class Config:
        from_attributes = True

class ServiceResponse(ServiceBase):
    id: str
    provider_id: str
    provider: Optional[ProviderMini] = None
    class Config:
        from_attributes = True


class ServiceFormFieldResponse(ServiceFormFieldCreate):
    id: str
    service_id: str
    created_at: datetime.datetime
    class Config:
        from_attributes = True

class OrderFormResponseSchema(BaseModel):
    field_id: str
    answer_value: Optional[str] = None

class OrderCreate(BaseModel):
    service_id: str
    share_phone: Optional[bool] = False
    form_responses: Optional[List[OrderFormResponseSchema]] = []

class OrderFormResponseMini(BaseModel):
    id: str
    field_id: str
    field_label: Optional[str] = None
    answer_value: Optional[str] = None
    class Config:
        from_attributes = True

class OrderResponse(BaseModel):
    id: str
    buyer_id: str
    service_id: str
    amount: float
    commission: float
    payout: float
    status: OrderStatus
    share_phone: bool
    created_at: datetime.datetime
    responses: List[OrderFormResponseMini] = []
    class Config:
        from_attributes = True

class EventBase(BaseModel):
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    start_time: datetime.datetime # ISO format expected
    end_time: datetime.datetime
    capacity: Optional[int] = 0
    category: Optional[str] = None
    is_public: Optional[int] = 1

class EventCreate(EventBase):
    pass

class EventResponse(EventBase):
    id: str
    registrant_count: Optional[int] = 0
    class Config:
        from_attributes = True



class RatingBase(BaseModel):
    order_id: str
    rated_id: str
    score: int
    comment: Optional[str] = None

class RatingCreate(RatingBase):
    pass

class RatingResponse(RatingBase):
    id: str
    rater_id: str
    created_at: datetime.datetime
    class Config:
        from_attributes = True

class FormResponseItem(BaseModel):
    field_id: str
    answer_value: Optional[str] = None

class RegistrationCreate(BaseModel):
    event_id: str
    dog_id: Optional[str] = None
    role: Optional[str] = "attendee"
    join_waitlist: Optional[bool] = False
    share_phone: Optional[bool] = False
    form_responses: Optional[List[FormResponseItem]] = []

class RegistrationResponse(BaseModel):
    id: str
    event_id: str
    user_id: str
    dog_id: Optional[str] = None
    status: str
    role: str
    share_phone: Optional[bool] = False
    check_in_time: Optional[datetime.datetime] = None
    ticket_token: Optional[str] = None
    created_at: datetime.datetime
    class Config:
        from_attributes = True

# --- Saved Events ---
class SavedEventResponse(BaseModel):
    id: str
    user_id: str
    event_id: str
    created_at: datetime.datetime
    event: Optional[EventResponse] = None
    class Config:
        from_attributes = True

# --- Event Form Builder ---
class EventFormFieldCreate(BaseModel):
    field_type: str  # short_answer, long_answer, dropdown, multiple_choice, scale
    label: str
    options: Optional[List[Dict[str, Any]]] = None  # [{"value": "Option A"}, ...]
    is_required: Optional[bool] = False
    sort_order: Optional[int] = 0

class EventFormFieldResponse(BaseModel):
    id: str
    event_id: str
    field_type: str
    label: str
    options: Optional[List[Dict[str, Any]]] = None
    is_required: bool
    sort_order: int
    created_at: datetime.datetime
    class Config:
        from_attributes = True

# --- Registration Form Responses ---
class RegistrationFormResponseItem(BaseModel):
    id: str
    field_id: str
    answer_value: Optional[str] = None
    created_at: datetime.datetime
    class Config:
        from_attributes = True

class RegistrationWithResponses(BaseModel):
    id: str
    event_id: str
    user_id: str
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_phone: Optional[str] = None
    dog_name: Optional[str] = None
    status: str
    role: str
    share_phone: Optional[bool] = False
    created_at: datetime.datetime
    responses: List[RegistrationFormResponseItem] = []
    class Config:
        from_attributes = True

class SupportTicketCreate(BaseModel):
    subject: str
    message: str
    images: Optional[List[str]] = None

class SupportTicketResponse(BaseModel):
    id: str
    user_id: str
    subject: str
    message: str
    status: str
    admin_reply: Optional[str] = None
    images: Optional[List[str]] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    class Config:
        from_attributes = True

class AnnouncementCreate(BaseModel):
    title: str
    message: str
    target_audience: Optional[str] = "all"

class AnnouncementResponse(BaseModel):
    id: str
    title: str
    message: str
    target_audience: str
    created_at: datetime.datetime
    class Config:
        from_attributes = True

class NotificationResponse(BaseModel):
    id: str
    user_id: str
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime.datetime
    class Config:
        from_attributes = True

class HealthRecordCreate(BaseModel):
    record_type: str
    date: str # ISO format
    next_due_date: Optional[str] = None
    notes: Optional[str] = None
# =====================================================

class HealthRecordResponse(BaseModel):
    id: str
    dog_id: str
    record_type: str
    date: datetime.datetime
    next_due_date: Optional[datetime.datetime] = None
    notes: Optional[str] = None
    created_at: datetime.datetime
    class Config:
        from_attributes = True

class CaseReportCreate(BaseModel):
    case_type: str  # rabies_bite, vehicle_hit, injured_stray, lost_dog, abuse, other
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    breed: Optional[str] = None
    color: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    images: Optional[List[str]] = None

class AuthorMini(BaseModel):
    id: str
    full_name: str
    profile_image: Optional[str] = None
    class Config:
        from_attributes = True

class CaseCommentResponse(BaseModel):
    id: str
    report_id: str
    author_id: str
    content: str
    tagged_users: Optional[list] = None
    created_at: datetime.datetime
    author: Optional[AuthorMini] = None
    class Config:
        from_attributes = True

class CaseReportResponse(BaseModel):
    id: str
    author_id: str
    case_type: str
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    breed: Optional[str] = None
    color: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    images: Optional[List[str]] = None
    status: str
    is_approved: Optional[bool] = False
    rejection_reason: Optional[str] = None
    created_at: datetime.datetime
    updated_at: Optional[datetime.datetime] = None
    author: Optional[AuthorMini] = None
    like_count: Optional[int] = 0
    comment_count: Optional[int] = 0
    is_liked: Optional[bool] = False
    class Config:
        from_attributes = True

class CaseCommentCreate(BaseModel):
    content: str
    tagged_users: Optional[List[str]] = None  # list of user IDs

# =====================================================
# Lovedogs 360 Event Specific Schemas
# =====================================================



class ProgramJourneyBase(BaseModel):
    event_id: str
    user_id: str
    dog_id: Optional[str] = None
    progress_percentage: float
    current_timepoint: str

class ProgramJourneyResponse(ProgramJourneyBase):
    id: str
    created_at: datetime.datetime
    updated_at: datetime.datetime
    class Config:
        from_attributes = True

class CheckInDataBase(BaseModel):
    event_id: str
    user_id: str
    dog_id: Optional[str] = None
    timepoint: str
    who5_answers: Optional[Dict[str, Any]] = None
    pss10_answers: Optional[Dict[str, Any]] = None
    relationship_answers: Optional[Dict[str, Any]] = None
    welfare_snapshot: Optional[Dict[str, Any]] = None

class CheckInDataCreate(CheckInDataBase):
    pass

class CheckInDataResponse(CheckInDataBase):
    id: str
    created_at: datetime.datetime
    class Config:
        from_attributes = True

class LiveObservationBase(BaseModel):
    event_id: str
    participant_id: str
    dog_id: Optional[str] = None
    behavior: str
    intensity: Optional[str] = None
    notes: Optional[str] = None
    timestamp: datetime.datetime
    is_offline_sync: Optional[bool] = False

class LiveObservationCreate(LiveObservationBase):
    pass

class LiveObservationResponse(LiveObservationBase):
    id: str
    observer_id: str
    synced_at: datetime.datetime
    class Config:
        from_attributes = True

class BulkSyncPayload(BaseModel):
    checkins: List[CheckInDataCreate] = []
    observations: List[LiveObservationCreate] = []

class GoogleLoginRequest(BaseModel):
    id_token: str

class GoogleLoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class SpotlightBase(BaseModel):
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    target_route: Optional[str] = None
    target_id: Optional[str] = None
    is_active: Optional[bool] = True

class SpotlightResponse(SpotlightBase):
    id: int
    updated_at: datetime.datetime
    class Config:
        from_attributes = True

# =====================================================
# Community Hub & Karma Schemas
# =====================================================

class CommunityMessageBase(BaseModel):
    content: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_global: Optional[bool] = True
    reshare_id: Optional[str] = None
    hashtags: Optional[List[str]] = []
    is_poll: Optional[bool] = False
    poll_options: Optional[List[Dict[str, Any]]] = None

class CommunityMessageCreate(CommunityMessageBase):
    pass

class ChatReactionResponse(BaseModel):
    id: str
    user_id: str
    reaction_type: str
    class Config:
        from_attributes = True

class CommunityMessageResponse(CommunityMessageBase):
    id: str
    author_id: str
    created_at: datetime.datetime
    author: Optional[AuthorMini] = None
    reactions: List[ChatReactionResponse] = []
    flag_count: int = 0
    is_hidden: bool = False
    poll_results: Optional[Dict[str, int]] = None
    has_voted: Optional[int] = None # The option_id they voted for, if any
    
    class Config:
        from_attributes = True

class PollVoteCreate(BaseModel):
    option_id: int

class TrendingTagResponse(BaseModel):
    tag: str
    count: int

class ChatReactionCreate(BaseModel):
    reaction_type: str # like, love, etc.

class DirectMessageBase(BaseModel):
    receiver_id: str
    content: str

class DirectMessageCreate(DirectMessageBase):
    pass

class DirectMessageResponse(DirectMessageBase):
    id: str
    sender_id: str
    created_at: datetime.datetime
    read_at: Optional[datetime.datetime] = None
    class Config:
        from_attributes = True

class KarmaTransactionResponse(BaseModel):
    id: str
    user_id: str
    amount: int
    category: str
    description: Optional[str] = None
    created_at: datetime.datetime
    class Config:
        from_attributes = True

class KarmaRedeemRequest(BaseModel):
    amount_to_redeem: int

