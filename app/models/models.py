from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from .base import Base
import uuid

class UserRole(enum.Enum):
    USER = "user"
    ADMIN = "admin"
    GLOBAL_ADMIN = "global_admin"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.USER)
    company_id = Column(Integer, ForeignKey('companies.id'))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime(timezone=True))

    company = relationship("Company", back_populates="users")

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    main_depot_address = Column(String)
    settings = Column(JSON)  # Store route settings, API keys, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True)

    users = relationship("User", back_populates="company")
    drivers = relationship("Driver", back_populates="company")
    locations = relationship("Location", back_populates="company")

class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    address_line1 = Column(String, nullable=False)
    address_line2 = Column(String)
    city = Column(String, nullable=False)
    postcode = Column(String, nullable=False)
    latitude = Column(Float)
    longitude = Column(Float)
    location_type = Column(String)  # 'depot', 'home', 'customer'
    company_id = Column(Integer, ForeignKey('companies.id'))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    company = relationship("Company", back_populates="locations")

class Driver(Base):
    __tablename__ = "drivers"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    phone = Column(String)
    email = Column(String)
    home_location_id = Column(Integer, ForeignKey('locations.id'))
    company_id = Column(Integer, ForeignKey('companies.id'))
    start_location_type = Column(String, nullable=False, default='depot')  # 'depot' or 'home'
    skills = Column(JSON)  # Store array of skills/certifications
    vehicle_type = Column(String)
    service_area = Column(Float)  # Radius in miles
    working_hours = Column(JSON)  # Store working hours for each day
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    company = relationship("Company", back_populates="drivers")
    home_location = relationship("Location")
    availability = relationship("DriverAvailability", back_populates="driver")
    routes = relationship("Route", back_populates="driver")

class DriverAvailability(Base):
    __tablename__ = "driver_availability"

    id = Column(Integer, primary_key=True)
    driver_id = Column(Integer, ForeignKey('drivers.id'))
    date = Column(DateTime(timezone=True), nullable=False)
    is_available = Column(Boolean, default=True)
    reason = Column(String)  # vacation, sick, training, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    driver = relationship("Driver", back_populates="availability")

class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True)
    reference = Column(String, unique=True, nullable=False)
    schedule_date = Column(DateTime(timezone=True), nullable=False)  # Date job is scheduled for
    location_id = Column(Integer, ForeignKey('locations.id'))
    company_id = Column(Integer, ForeignKey('companies.id'))
    client = Column(String)
    job_type = Column(String)
    priority = Column(Integer)
    sla_date = Column(DateTime(timezone=True))
    estimated_duration = Column(Integer)  # in minutes
    special_requirements = Column(String)
    contact_name = Column(String)
    contact_number = Column(String)
    status = Column(String, default='pending')  # pending, assigned, completed, cancelled
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    location = relationship("Location")
    routes = relationship("RouteJob", back_populates="job")

class Route(Base):
    __tablename__ = "routes"

    id = Column(Integer, primary_key=True)
    driver_id = Column(Integer, ForeignKey('drivers.id'))
    company_id = Column(Integer, ForeignKey('companies.id'))
    date = Column(DateTime(timezone=True), nullable=False)
    start_location_id = Column(Integer, ForeignKey('locations.id'))
    end_location_id = Column(Integer, ForeignKey('locations.id'))
    total_distance = Column(Float)  # in miles
    total_time = Column(Integer)  # in minutes
    status = Column(String, default='planned')  # planned, in_progress, completed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    driver = relationship("Driver", back_populates="routes")
    jobs = relationship("RouteJob", back_populates="route")
    start_location = relationship("Location", foreign_keys=[start_location_id])
    end_location = relationship("Location", foreign_keys=[end_location_id])

class RouteJob(Base):
    __tablename__ = "route_jobs"

    id = Column(Integer, primary_key=True)
    route_id = Column(Integer, ForeignKey('routes.id'))
    job_id = Column(Integer, ForeignKey('jobs.id'))
    sequence = Column(Integer, nullable=False)
    estimated_arrival = Column(DateTime(timezone=True))
    actual_arrival = Column(DateTime(timezone=True))
    actual_completion = Column(DateTime(timezone=True))
    status = Column(String, default='pending')  # pending, completed, failed, skipped
    notes = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    route = relationship("Route", back_populates="jobs")
    job = relationship("Job", back_populates="routes")
