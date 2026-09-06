from fastapi import APIRouter, Depends, HTTPException
from app.utils.dependencies import get_current_user

router = APIRouter(prefix='/users', tags=['Users'])


@router.api_route('', methods=['GET', 'POST'], dependencies=[Depends(get_current_user)])
@router.api_route('/{path:path}', methods=['GET', 'POST', 'PUT', 'DELETE'], dependencies=[Depends(get_current_user)])
def retired_global_user_management(path: str = ''):
    raise HTTPException(410, 'La gestión global de usuarios fue retirada. Administrá los participantes desde su proyecto. '
                        'Cada usuario recupera su propia contraseña desde el inicio de sesión.')
