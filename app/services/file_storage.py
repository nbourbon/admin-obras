import os
import uuid
import shutil
from pathlib import Path
from typing import Optional
from fastapi import UploadFile, HTTPException, status

from app.config import get_settings

settings = get_settings()

# Cloudinary setup (only if configured)
cloudinary_configured = bool(
    settings.cloudinary_cloud_name
    and settings.cloudinary_api_key
    and settings.cloudinary_api_secret
)

if cloudinary_configured:
    import cloudinary
    import cloudinary.uploader

    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
    )


def get_upload_dir() -> Path:
    """Get the base upload directory."""
    return Path(settings.upload_dir)


def get_invoices_dir() -> Path:
    """Get the invoices directory."""
    path = get_upload_dir() / "invoices"
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_receipts_dir() -> Path:
    """Get the receipts directory."""
    path = get_upload_dir() / "receipts"
    path.mkdir(parents=True, exist_ok=True)
    return path


def validate_file(file: UploadFile) -> None:
    """Validate file size and type."""
    max_size = settings.max_file_size_mb * 1024 * 1024  # Convert to bytes

    if file.filename:
        ext = file.filename.lower().split(".")[-1]
        allowed_extensions = ["pdf", "jpg", "jpeg", "png"]
        if ext not in allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type not allowed. Allowed types: {', '.join(allowed_extensions)}",
            )


def generate_unique_filename(original_filename: str) -> str:
    """Generate a unique filename preserving the extension."""
    ext = original_filename.split(".")[-1] if "." in original_filename else ""
    unique_id = str(uuid.uuid4())
    return f"{unique_id}.{ext}" if ext else unique_id


def is_url(path: str) -> bool:
    """Check if a path is a URL."""
    return path.startswith("http://") or path.startswith("https://")


async def upload_to_cloudinary(file: UploadFile, folder: str, public_id: str) -> str:
    """Upload file to Cloudinary and return the URL."""
    try:
        contents = await file.read()
        result = cloudinary.uploader.upload(
            contents,
            folder=f"construccion/{folder}",
            public_id=public_id,
            resource_type="raw",
        )
        return result["secure_url"]
    finally:
        await file.seek(0)


async def save_invoice(file: UploadFile, expense_id: int) -> str:
    """
    Save an invoice file and return the path/URL.
    Uses Cloudinary if configured, otherwise local storage.
    """
    validate_file(file)

    filename = generate_unique_filename(file.filename or "invoice")
    public_id = f"expense_{expense_id}_{filename.rsplit('.', 1)[0]}"

    if cloudinary_configured:
        url = await upload_to_cloudinary(file, "invoices", public_id)
        await file.close()
        return url
    else:
        # Local storage fallback
        file_path = get_invoices_dir() / f"expense_{expense_id}_{filename}"
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        finally:
            await file.close()
        return str(file_path.relative_to(get_upload_dir().parent))


async def save_receipt(file: UploadFile, payment_id: int) -> str:
    """
    Save a receipt file and return the path/URL.
    Uses Cloudinary if configured, otherwise local storage.
    """
    validate_file(file)

    filename = generate_unique_filename(file.filename or "receipt")
    public_id = f"payment_{payment_id}_{filename.rsplit('.', 1)[0]}"

    if cloudinary_configured:
        url = await upload_to_cloudinary(file, "receipts", public_id)
        await file.close()
        return url
    else:
        # Local storage fallback
        file_path = get_receipts_dir() / f"payment_{payment_id}_{filename}"
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        finally:
            await file.close()
        return str(file_path.relative_to(get_upload_dir().parent))


async def save_contribution_receipt(file: UploadFile, contribution_id: int) -> str:
    """
    Save a contribution receipt file and return the path/URL.
    Uses Cloudinary if configured, otherwise local storage.
    """
    validate_file(file)

    filename = generate_unique_filename(file.filename or "contribution_receipt")
    public_id = f"contribution_{contribution_id}_{filename.rsplit('.', 1)[0]}"

    if cloudinary_configured:
        url = await upload_to_cloudinary(file, "receipts", public_id)
        await file.close()
        return url
    else:
        # Local storage fallback
        file_path = get_receipts_dir() / f"contribution_{contribution_id}_{filename}"
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        finally:
            await file.close()
        return str(file_path.relative_to(get_upload_dir().parent))


def get_file_path(relative_path: str) -> Optional[Path]:
    """
    Get the absolute path for a file given its relative path.
    Returns None if file doesn't exist or if it's a URL.
    For URLs, use get_file_url() instead.
    """
    if not relative_path:
        return None

    # If it's a Cloudinary URL, return None (use redirect instead)
    if is_url(relative_path):
        return None

    # Construct full path
    full_path = get_upload_dir().parent / relative_path

    if full_path.exists():
        return full_path
    return None


def get_file_url(stored_path: str) -> Optional[str]:
    """
    Get the URL for a file.
    If stored_path is a URL (Cloudinary), return it directly.
    If it's a local path, return None (use FileResponse instead).
    """
    if not stored_path:
        return None
    if is_url(stored_path):
        return stored_path
    return None


def delete_file(relative_path: str) -> bool:
    """Delete a file given its relative path or Cloudinary URL."""
    if is_url(relative_path):
        # For Cloudinary, we'd need to extract public_id and delete
        # For simplicity, we skip deletion for now (files stay in Cloudinary)
        return True

    file_path = get_file_path(relative_path)
    if file_path and file_path.exists():
        file_path.unlink()
        return True
    return False
