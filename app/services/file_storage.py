import os
import uuid
import shutil
from pathlib import Path
from typing import Optional
from fastapi import UploadFile, HTTPException, status

from app.config import get_settings

settings = get_settings()


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
    # Check file size (read content and check)
    # Note: For large files, you might want to use streaming
    max_size = settings.max_file_size_mb * 1024 * 1024  # Convert to bytes

    # Get file extension
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


async def save_invoice(file: UploadFile, expense_id: int) -> str:
    """
    Save an invoice file and return the relative path.
    """
    validate_file(file)

    filename = generate_unique_filename(file.filename or "invoice")
    # Include expense_id in path for organization
    file_path = get_invoices_dir() / f"expense_{expense_id}_{filename}"

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    finally:
        await file.close()

    # Return relative path
    return str(file_path.relative_to(get_upload_dir().parent))


async def save_receipt(file: UploadFile, payment_id: int) -> str:
    """
    Save a receipt file and return the relative path.
    """
    validate_file(file)

    filename = generate_unique_filename(file.filename or "receipt")
    file_path = get_receipts_dir() / f"payment_{payment_id}_{filename}"

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    finally:
        await file.close()

    return str(file_path.relative_to(get_upload_dir().parent))


def get_file_path(relative_path: str) -> Optional[Path]:
    """
    Get the absolute path for a file given its relative path.
    Returns None if file doesn't exist.
    """
    if not relative_path:
        return None

    # Construct full path
    full_path = get_upload_dir().parent / relative_path

    if full_path.exists():
        return full_path
    return None


def delete_file(relative_path: str) -> bool:
    """Delete a file given its relative path."""
    file_path = get_file_path(relative_path)
    if file_path and file_path.exists():
        file_path.unlink()
        return True
    return False
