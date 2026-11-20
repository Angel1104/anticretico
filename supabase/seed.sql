-- 6 properties covering every lifecycle state for the hackathon demo.

insert into properties (slug, state, ciudad, barrio, address, target_usdc, rent_monthly_usdc, duration_months, images_urls, description)
values
  (
    'casa-sopocachi-la-paz',
    'En fondeo',
    'La Paz',
    'Sopocachi',
    'Av. 20 de Octubre #1234',
    12000, 320, 24,
    array['/seed/sopocachi.jpg'],
    'Casa unifamiliar de 180 m² en Sopocachi, zona residencial consolidada de La Paz. Dos plantas, cuatro dormitorios, parqueo privado.'
  ),
  (
    'depto-equipetrol-santa-cruz',
    'En trámite',
    'Santa Cruz',
    'Equipetrol',
    'Calle San Martín #567',
    18000, 450, 24,
    array['/seed/equipetrol.jpg'],
    'Departamento de 95 m² en el corazón de Equipetrol, Santa Cruz. Edificio con seguridad 24/7 y acceso a amenities.'
  ),
  (
    'casa-miraflores-cochabamba',
    'En trámite',
    'Cochabamba',
    'Miraflores',
    'Av. Oquendo #890',
    10000, 260, 24,
    array['/seed/miraflores.jpg'],
    'Casa de 150 m² en Miraflores, Cochabamba. Tres dormitorios, patio, jardín.'
  ),
  (
    'depto-calacoto-la-paz',
    'Buscando inquilino',
    'La Paz',
    'Calacoto',
    'Calle 21 de Calacoto #345',
    25000, 620, 24,
    array['/seed/calacoto.jpg'],
    'Departamento de lujo de 120 m² en Calacoto, zona sur de La Paz. Dos dormitorios, estudio, vista panorámica.'
  ),
  (
    'casa-sucre-centro',
    'Alquilado',
    'Sucre',
    'Centro',
    'Calle Dalence #123',
    15000, 380, 24,
    array['/seed/sucre.jpg'],
    'Casa colonial restaurada en el centro histórico de Sucre. 200 m², tres dormitorios, patio central.'
  )
  on conflict (slug) do nothing;

insert into properties (slug, state, ciudad, barrio, address, target_usdc, rent_monthly_usdc, duration_months, images_urls, description, dr_inscription_date)
values
  (
    'depto-sopocachi-la-paz-2022',
    'Finalizado',
    'La Paz',
    'Sopocachi',
    'Av. Ecuador #2345',
    20000, 480, 24,
    array['/seed/sopocachi-2.jpg'],
    'Anticrético completado. Duración de 24 meses. Capital devuelto a los inversionistas.',
    (now() - interval '26 months')::date
  )
  on conflict (slug) do nothing;
